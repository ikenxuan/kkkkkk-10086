import { Common, sanitizeFilenameSegment, uploadFile } from '../../../module/utils/index.js';
import { recordLiveStream } from '../../../module/utils/FFmpeg.js';
import { fromMilliseconds, reportMedia } from '../../../module/utils/media-metrics.js';
import { getLivePreviewDB } from '../../../module/db/index.js';
import { resolveLiveSource } from './liveRecord.js';
/**
 * 预览时长，秒。
 *
 * 硬编码而不是开配置项：这条路径**每次**解析直播链接都会触发，不是用户主动要的录制。
 * 15 秒够看清主播在干什么，中档画质下落盘几 MB，撞不上体积闸；一旦开成配置项，
 * 有人填 300 就等于给自己造了一个每条链接都录五分钟的队列。
 * 想录长的走 `#kkk录直播`，那条路有自己的 `live.maxDuration`。
 */
const PREVIEW_DURATION_MS = 15_000;
/**
 * 预览用的画质：抖音 flv 的 `SD1`、B站的 250（超清）。
 *
 * 不跟 `live.quality` / `live.qn` 走 —— 那两个是给主动录制用的，默认是原画。
 * 预览要的是快和小：中档在手机上看得清，原画在无条件触发的前提下纯属浪费带宽。
 * 取不到这一档时两边的取流层都会自动往下试其它档，所以「这一档没转码」不会变成失败。
 */
const PREVIEW_DOUYIN_QUALITY = 'SD1';
const PREVIEW_BILIBILI_QN = 250;
/**
 * 队列深度上限。
 *
 * 并发 1 + 每项 15 秒，意味着消费速度是每 15 秒一项，排到第 20 项已经是五分钟后 ——
 * 那时候预览的画面和用户当初转的那一刻早就没关系了。满了丢新的而不是丢最旧的：
 * 早先排上的那些人已经等了更久，把他们挤掉更亏。
 */
const MAX_QUEUE_DEPTH = 20;
/** roomKey -> 待处理项。Map 同时充当去重表：同一个房间只会有一项 */
const queue = new Map();
/**
 * 正在录的那一项。
 *
 * 去重不能只看 `queue`：{@link drain} 一开始就把项从 Map 里删掉了（删了才能表示
 * 「已认领」），于是录制期间同一个房间再被转一次会在 Map 里查不到、又建一项、又录一遍。
 * 所以「在队里」和「正在录」两处都要查。
 */
let active = null;
/** 消费循环的句柄。非空表示循环正在跑，用它保证全局并发 1 */
let draining = null;
/**
 * 组装去重键。
 *
 * 带平台前缀：抖音的 web_rid 和B站的房间号都是纯数字，不加前缀会让两个平台的
 * 同号房间被当成同一个。
 * @param platform 平台
 * @param roomId 房间号
 * @returns 形如 `douyin:123456`
 */
export const livePreviewRoomKey = (platform, roomId) => `${platform}:${roomId}`;
/**
 * 从事件里读出「重启后还能把消息发回来」所需的三个字段。
 *
 * `self_id` 必须记：多 bot 实例同时在线时，用别的实例去 pickGroup 是串台。
 * 群号取不到就按私聊处理 —— 私聊事件没有 group_id，而 `user_id` 两种场景都有。
 * @param e 触发解析的事件
 * @returns 会话定位信息；连 user_id 都没有时返回 undefined
 */
const readSession = (e) => {
    const selfId = e.self_id === undefined || e.self_id === null ? '' : String(e.self_id);
    const groupId = e.group_id === undefined || e.group_id === null ? '' : String(e.group_id);
    const userId = e.user_id === undefined || e.user_id === null ? '' : String(e.user_id);
    if (!selfId)
        return undefined;
    if (groupId)
        return { selfId, sessionType: 'group', sessionId: groupId };
    if (userId)
        return { selfId, sessionType: 'private', sessionId: userId };
    return undefined;
};
/**
 * 把一个直播间排进预览队列。
 *
 * 全程静默：入队、开始录、录失败都不发消息。这条路径不是用户主动要的，
 * 每条直播链接都多两三条状态提示只会变成噪音。唯一会发出去的是录成功那一条视频。
 *
 * ## 认领必须在 await 之前
 *
 * 「查队列 → await 落盘 → 写队列」这个顺序有竞态：同一个直播间的两条消息几乎同时到达时，
 * 两边都在 await 里，各自看到的都是「队列里没有」，于是各自建一项、各录一次。
 * 所以对 `queue` 的读改写全部挤在第一个 await 之前 —— 单线程下没有 await 就没有交错点，
 * 这就是这里的去重保证。落盘放在认领之后，它的完成时机由 `job.ledger` 串起来。
 * @param e 触发解析的事件
 * @param platform 平台
 * @param roomId 房间号，用来组去重键
 * @param roomUrl 直播间链接，重启后重新取流要用
 */
export const enqueueLivePreview = async (e, platform, roomId, roomUrl) => {
    const session = readSession(e);
    if (!session) {
        logger.debug('[直播预览] 事件里没有 self_id 或会话号，跳过');
        return;
    }
    const roomKey = livePreviewRoomKey(platform, roomId);
    const existing = queue.get(roomKey) ?? (active?.roomKey === roomKey ? active : undefined);
    // 深度上限只拦「新房间」：已经在队里的房间再来一个订阅者，只是名单加一行，
    // 不多一次录制，没有理由拒绝。
    if (!existing && queue.size >= MAX_QUEUE_DEPTH) {
        logger.debug(`[直播预览] 队列已满（${MAX_QUEUE_DEPTH}），丢弃 ${roomKey}`);
        return;
    }
    const write = async () => {
        const db = await getLivePreviewDB();
        await db?.enqueue({ ...session, platform, roomKey, roomUrl });
    };
    const job = existing ?? { platform, roomKey, roomUrl, events: [], ledger: Promise.resolve() };
    job.events.push(e);
    // 串在现有链后面而不是并发发起：同一房间的多个订阅者写的是同一张表，
    // 顺序写让「先到的排在前面」这件事在账本里也成立。
    // catch 收在这里，否则一次落盘失败会让 drain 那边的 await 变成未处理的 rejection。
    job.ledger = job.ledger
        .then(write)
        .catch(error => logger.debug(`[直播预览] ${roomKey} 落盘失败`, error));
    if (!existing)
        queue.set(roomKey, job);
    startDraining();
    // 认领已经在上面同步做完了，这里 await 只是让调用点的「入队完成」包含落盘，
    // 不影响去重。录制本身不在这条 await 上 —— 那才是「不占解析预算」的关键。
    await job.ledger;
};
/**
 * 启动消费循环。已经在跑就什么都不做 —— 这是「全局并发 1」的全部实现。
 */
const startDraining = () => {
    draining ??= drain().finally(() => {
        draining = null;
        // 收尾时队列又非空：最后一项录制期间有新的进来，接着跑而不是等下一次入队来唤醒
        if (queue.size > 0)
            startDraining();
    });
};
/** 顺序消费队列。一项失败不影响下一项 */
const drain = async () => {
    while (queue.size > 0) {
        const [job] = queue.values();
        if (!job)
            break;
        // 从 Map 移到 active：两处合起来才是完整的去重域（见 active 的注释）
        queue.delete(job.roomKey);
        active = job;
        try {
            await runJob(job);
        }
        catch (error) {
            logger.debug(`[直播预览] ${job.roomKey} 录制失败`, error);
        }
        // 发完就退出去重域。这之后同一个房间再被转，应该重新录一段新的 ——
        // 挂到这个已经发完的项上只会让那个人什么都收不到。
        active = null;
        // 无论成败都放掉账本：失败了不该在下次重启时又试一遍，那时候直播多半已经结束。
        // 先等落盘链跑完 —— 迟到的那条订阅行落在 release 之后就成了孤儿，
        // 下次启动会把它当未完成的项再录一遍（见 PreviewJob.ledger）。
        await job.ledger;
        const db = await getLivePreviewDB();
        await db?.release(job.roomKey);
    }
};
/**
 * 录一项并发给它的所有订阅者。
 * @param job 队列项
 */
const runJob = async (job) => {
    const resolved = await resolveLiveSource(job.platform, job.roomUrl, {
        douyinQuality: PREVIEW_DOUYIN_QUALITY,
        bilibiliQn: PREVIEW_BILIBILI_QN
    });
    // 关播、拿不到地址都在这里收口。静默是设计：用户没要过这段预览
    if (!resolved.ok) {
        logger.debug(`[直播预览] ${job.roomKey} 取流失败：${resolved.message}`);
        return;
    }
    const { source } = resolved;
    await Common.mkdir(Common.tempDri.video);
    const outputPath = `${Common.tempDri.video}${sanitizeFilenameSegment(`预览_${source.name}`)}_${Date.now()}.${source.suffix}`;
    const result = await recordLiveStream({
        url: source.url,
        outputPath,
        maxDurationMs: PREVIEW_DURATION_MS,
        headers: source.headers
    });
    // `success` 的判据是盘上有没有字节，所以走到这里就是真的一个字节都没录到
    if (!result.success) {
        logger.debug(`[直播预览] ${job.roomKey} 一个字节都没录到`);
        return;
    }
    const sizeMB = await Common.getVideoFileSize(result.filePath);
    reportMedia({
        kind: 'video',
        durationMs: fromMilliseconds(result.durationMs),
        bytes: result.bytes
    });
    await deliver(job, result.filePath, sizeMB, `${source.name}.${source.suffix}`);
    await Common.removeFile(result.filePath, true);
};
/**
 * 把录好的文件发给所有订阅者。
 *
 * 运行期的订阅者用 `e.reply` 那条路（`uploadFile` 要的就是事件对象）；
 * 账本里那些没有对应事件的行走 {@link deliverToRow}。两条路都走一遍，
 * 靠会话标识去重 —— 重启前入队、重启后又被同一个会话转了一次的情况会两边都在。
 * @param job 队列项
 * @param filePath 录好的文件
 * @param sizeMB 文件体积（MB）
 * @param originTitle 发送时用的文件名
 */
const deliver = async (job, filePath, sizeMB, originTitle) => {
    const db = await getLivePreviewDB();
    const rows = await db?.subscribers(job.roomKey) ?? [];
    const delivered = new Set();
    for (const e of job.events) {
        const session = readSession(e);
        const tag = session ? `${session.selfId}:${session.sessionType}:${session.sessionId}` : '';
        if (tag && delivered.has(tag))
            continue;
        if (tag)
            delivered.add(tag);
        // 只发视频，不带说明文字：版式要求预览是一条独立的视频消息
        await uploadFile(e, { filepath: filePath, totalBytes: sizeMB, originTitle }, '');
    }
    for (const row of rows) {
        const tag = `${row.selfId}:${row.sessionType}:${row.sessionId}`;
        if (delivered.has(tag))
            continue;
        delivered.add(tag);
        await deliverToRow(row, filePath);
    }
};
/**
 * 重启后补发那条路：没有事件对象，只能拿 self_id 去找 bot 实例主动发。
 *
 * `Bot[selfId]` 而不是裸 `Bot`：多实例在线时后者是随机挑一个已登录的号，
 * 消息会从别的 bot 发出去（串台）。这个形状和 `Base.ts` 里压缩完成那条通知一致。
 *
 * 这条路发的是本地文件路径而不是走 `uploadFile` —— 那个函数要事件对象，
 * 而这里根本没有。代价是拿不到群文件那条大文件通道，但 15 秒的预览用不上。
 * @param row 账本行
 * @param filePath 录好的文件
 */
const deliverToRow = async (row, filePath) => {
    const bot = globalThis.Bot?.[row.selfId];
    if (!bot) {
        logger.debug(`[直播预览] 找不到 bot 实例 ${row.selfId}，跳过补发`);
        return;
    }
    const target = row.sessionType === 'group'
        ? bot.pickGroup?.(row.sessionId)
        : bot.pickFriend?.(row.sessionId);
    if (!target?.sendMsg) {
        logger.debug(`[直播预览] ${row.selfId} 取不到会话 ${row.sessionId}，跳过补发`);
        return;
    }
    await target.sendMsg(segment.video(filePath));
};
/**
 * 启动时把账本里剩下的项重新排队。
 *
 * 只重排，不在这里判直播还在不在播 —— {@link runJob} 的取流那一步本来就会判，
 * 关播时它返回「没开播」并静默收场。多写一次开播状态查询等于多一次请求、多一处判据。
 *
 * 恢复出来的项 `events` 是空的：`e` 序列化不了，所以这些项录完只走
 * {@link deliverToRow} 那条主动发送的路。
 * @returns 重新排队的房间数
 */
export const restoreLivePreviewQueue = async () => {
    const db = await getLivePreviewDB();
    const rows = await db?.pending() ?? [];
    let restored = 0;
    for (const row of rows) {
        // 同一个房间在账本里是多行（一行一个订阅者），只排一项
        if (queue.has(row.roomKey) || active?.roomKey === row.roomKey)
            continue;
        if (queue.size >= MAX_QUEUE_DEPTH) {
            logger.debug('[直播预览] 恢复时队列已满，剩下的行留在账本里等下次启动');
            break;
        }
        if (row.platform !== 'douyin' && row.platform !== 'bilibili')
            continue;
        queue.set(row.roomKey, {
            platform: row.platform,
            roomKey: row.roomKey,
            roomUrl: row.roomUrl,
            events: [],
            // 这些行本来就在账本里，没有待写入的东西
            ledger: Promise.resolve()
        });
        restored++;
    }
    if (restored > 0) {
        logger.info(`[直播预览] 从账本恢复 ${restored} 个直播间的预览录制`);
        startDraining();
    }
    return restored;
};
/** 测试用：清掉内存队列。生产路径不该调它 */
export const __resetLivePreviewQueue = () => {
    queue.clear();
    active = null;
    draining = null;
};
/**
 * 测试用：等到队列跑空。
 *
 * 消费循环是个不带定时器的 promise 链，`enqueueLivePreview` 故意不 await 它
 * （那就等于把录制拉回解析路径上了）。所以测试只能等条件成立：
 * 一轮 drain 收尾时可能又启动了下一轮，所以要循环 await 而不是只 await 一次。
 * 兜一个真实时钟的超时，免得逻辑写错时测试挂死而不是翻红。
 * @param timeoutMs 最长等待时间
 */
export const __awaitLivePreviewIdle = async (timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        // 每轮重新读：`draining` 由 startDraining 的 finally 改写，
        // 写在 while 条件里会被 no-unmodified-loop-condition 判成不变量
        const current = draining;
        if (!current)
            return;
        if (Date.now() > deadline)
            throw new Error('直播预览队列在超时前没有跑空');
        await current;
    }
};
