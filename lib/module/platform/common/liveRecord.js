import { Common, Config, baseHeaders, sanitizeFilenameSegment, uploadFile } from '../../../module/utils/index.js';
import { recordLiveStream } from '../../../module/utils/FFmpeg.js';
import { fromMilliseconds, reportMedia } from '../../../module/utils/media-metrics.js';
import { DEFAULT_PARSE_TIMEOUT_MS } from '../../../module/utils/ParseCoordinator.js';
import { getDouyinID } from '../../../module/platform/douyin/index.js';
import { getBilibiliID } from '../../../module/platform/bilibili/index.js';
import { buildAmagiRequestConfig, douyinFetcher } from '../../../module/utils/amagiClient.js';
// 两个取流模块都**不在**各自平台的 barrel 里（douyin/index.ts 与 bilibili/index.ts
// 的导出清单都没有它们），所以只能深引用。别顺手加进 barrel：那两个 barrel 被大量
// 测试用手写字面量 mock，加一项就得同步改一圈。
import { pickDouyinLiveStream } from '../../../module/platform/douyin/live.js';
import { resolveDouyinLiveRoom } from '../../../module/platform/douyin/live-room.js';
import { fetchBilibiliLiveStream } from '../../../module/platform/bilibili/live-stream.js';
/** 配置缺项时的录制时长，秒。与 `config/default_config/*.yaml` 里的 `live.maxDuration` 同值 */
const DEFAULT_RECORD_SECONDS = 300;
/**
 * 录制收尾（探体积 + 上传）要留的余量。
 *
 * 上传一个上百 MB 的文件在群文件通道上是按分钟计的，所以它必须从录制时长里扣，
 * 而不是指望它「顺便就完了」。取 2 分钟，和 `ParseCoordinator` 里
 * `PARSE_DISPATCH_HEADROOM_MS` 同一个量级、同一个理由。
 */
const LIVE_RECORD_UPLOAD_HEADROOM_MS = 120_000;
/**
 * 单次录制的硬上限，**从协调器的整次解析预算推导，不是独立选的数字**。
 *
 * 锅巴给 `live.maxDuration` 开的范围是 1~7200 秒，而录制整段跑在
 * `runCoordinatedParse` 里面。超过 `DEFAULT_PARSE_TIMEOUT_MS` 的那部分不是
 * 「录得更久」，而是 ParseCoordinator 注释里写明的那个赛跑：协调器在预算处判这次解析
 * 失败、把指纹和并发位都放掉，而 ffmpeg 还在录 —— 表情回应先翻成失败，几十分钟后
 * 文件又发出来，用户看到「失败了但又成功了」，期间同一个直播间重发还会再起一次录制。
 *
 * 所以这里按上限截断并如实告知用户，而不是让它跑进一个已知的坏状态。
 * 要放宽，去调 ParseCoordinator 的预算，别把这里换成字面量。
 */
export const LIVE_RECORD_MAX_DURATION_MS = DEFAULT_PARSE_TIMEOUT_MS - LIVE_RECORD_UPLOAD_HEADROOM_MS;
/**
 * B站直播的容器格式 -> 落盘后缀。
 *
 * `fetchBilibiliLiveStream` 的 `format` 是响应里实际命中的那一档
 * （它按 `protocol=0,1` / `format=0,1,2` 的顺序取第一个可用项，所以正常情况下就是
 * http-flv），这里只负责把它翻成后缀 —— ffmpeg 是按输出文件的扩展名选封装器的，
 * 后缀写错等于让它把 ts 的字节塞进 flv 封装。
 *
 * `fmp4` 映射到 `.mp4` 是如实映射，但它是这三档里唯一在「外层 timeout 不得不 SIGTERM」
 * 时会废掉的（moov atom 收尾才写）。正常路径上 ffmpeg 靠 `-t` 自己收口、文件是完整的，
 * 所以不为这一档单独发明转封装 —— 那是 recordLiveStream 明确划在职责外的事。
 */
const BILIBILI_LIVE_SUFFIX = {
    flv: 'flv',
    ts: 'ts',
    fmp4: 'mp4'
};
/**
 * 配置的录制时长，换算成毫秒并按 {@link LIVE_RECORD_MAX_DURATION_MS} 截断。
 *
 * 逐项读 `live?.maxDuration || 默认值` 而不是指望配置合并补默认值：`getDefOrConfig`
 * 是浅展开，用户 yaml 里写了 `live: { quality: 'SD1' }` 而没写 maxDuration 时，
 * 拿到的是 `maxDuration: undefined`，默认值**不会**逐键填进来。
 */
const resolveMaxDuration = (configuredSeconds) => {
    const seconds = Number(configuredSeconds) > 0 ? Number(configuredSeconds) : DEFAULT_RECORD_SECONDS;
    const ms = seconds * 1000;
    return ms > LIVE_RECORD_MAX_DURATION_MS
        ? { ms: LIVE_RECORD_MAX_DURATION_MS, clamped: true }
        : { ms, clamped: false };
};
/** 抖音：链接 -> 直播间 -> flv 档位 */
const resolveDouyinSource = async (url, quality) => {
    const idData = await getDouyinID(url);
    if (idData.type !== 'live_room_detail') {
        return { ok: false, message: '这条抖音链接不是直播间，录直播只认直播间链接' };
    }
    // 取数走裸 fetcher 而不是 Base 里那层带错误卡片的 amagi Proxy：
    // 那个 Proxy 挂在 DouYin 实例上（要先 new 一个解析器），而这里没有解析上下文。
    const room = await resolveDouyinLiveRoom({ sec_uid: idData.sec_uid, room_id: idData.room_id }, 
    // 按 method 分支而不是 `douyinFetcher[method]` 下标取：下标要把整个函数断言掉，
    // amagi 改了方法名时拿到的是 undefined、崩在运行时；分支写死真名则构建期就报错。
    async (method, options) => method === 'fetchLiveRoomInfo'
        ? await douyinFetcher.fetchLiveRoomInfo(options, Config.cookies.douyin, buildAmagiRequestConfig())
        : await douyinFetcher.fetchUserProfile(options, Config.cookies.douyin, buildAmagiRequestConfig()));
    if (!room.living) {
        return { ok: false, message: `「${room.anchor.nickname}」未开播，没有流可以录` };
    }
    // 配置的档位只是「插到队首」，不是「只认它」：抖音某个档位没转码是常态，
    // 只认配置值会让一条其实可播的流被判成录不到（见 pickDouyinLiveStream 的注释）。
    // `quality` 给了就顶掉配置值 —— 预览录制走的是固定中档，不跟用户配的录制画质。
    const pick = pickDouyinLiveStream(room.liveItem, quality || Config.douyin.live?.quality || 'FULL_HD1');
    if (!pick.url) {
        return { ok: false, message: '这个直播间没给出可用的 flv 拉流地址，录不了' };
    }
    return {
        ok: true,
        source: {
            url: pick.url,
            qualityName: pick.qualityName,
            // 抖音的 `flv_pull_url` 本来就是 flv，不需要换封装
            suffix: 'flv',
            // 抖音的拉流地址自带签名、实测不校验 Referer，但仍然照着
            // `tools.ts` 抖音直链下载那条路的形状带上 UA 与 Referer：多给两个头不会让
            // 拉流失败，缺了却可能在 CDN 侧被当成非浏览器流量。
            //
            // 那句 as 和 `bilibili/live-stream.ts` 里的同源：`baseHeaders` 是 axios 的
            // 请求头类型（每个值都可能是 null / number / string[]），而
            // `recordLiveStream` 要的是纯 `Record<string, string>`（它要把这些拼进
            // ffmpeg 的 `-headers`）。实际值全是字符串，收窄的是类型不是内容。
            headers: { ...baseHeaders, Referer: 'https://live.douyin.com/' },
            name: sanitizeFilenameSegment(`抖音直播_${room.anchor.nickname}_${room.webRid}`),
            title: room.liveItem.title ?? ''
        }
    };
};
/** B站：链接 -> 房间号 -> playurl */
const resolveBilibiliSource = async (url, qn) => {
    const idData = await getBilibiliID(url);
    if (idData.type !== 'live_room_detail' || !idData.room_id) {
        return { ok: false, message: '这条B站链接不是直播间，录直播只认直播间链接' };
    }
    const roomId = String(idData.room_id);
    // `qn` 给了就顶掉配置值，理由同抖音那边：预览走固定中档
    const pick = await fetchBilibiliLiveStream(roomId, qn || Config.bilibili.live?.qn || 10000);
    if (!pick.url) {
        return { ok: false, message: '拿不到这个B站直播间的拉流地址，可能已关播或该画质不可用' };
    }
    return {
        ok: true,
        source: {
            url: pick.url,
            qualityName: pick.qualityName,
            suffix: BILIBILI_LIVE_SUFFIX[pick.format] ?? 'flv',
            // 这份 headers 是 fetchBilibiliLiveStream 请求时实际用的那一份，原样带下去：
            // B站的拉流 CDN 校验 Referer，少了就是 403，而 403 在 ffmpeg 日志里长得像
            // 「地址失效」。
            headers: pick.headers,
            name: sanitizeFilenameSegment(`B站直播_${roomId}`),
            title: ''
        }
    };
};
/**
 * 从一条直播间链接取一路可录的流。
 *
 * 导出是给预览录制（`common/livePreview.ts`）复用的 —— 它要的取流步骤和录制完全一样，
 * 只有画质不同。抄第二份的代价是两条路对「不是直播间链接」「没开播」「拿不到地址」
 * 三种失败给出不同的判据，而这三种恰恰是最常见的。
 * @param platform 已判定好的平台
 * @param url 直播间链接
 * @param override 画质覆盖，不给就用各平台的录制配置
 * @returns 取流结果，失败时带一句给用户看的话
 */
export const resolveLiveSource = async (platform, url, override = {}) => platform === 'douyin'
    ? await resolveDouyinSource(url, override.douyinQuality)
    : await resolveBilibiliSource(url, override.bilibiliQn);
/**
 * 录一段直播并上传。
 *
 * 跑在 `runCoordinatedParse` 里面，所以这里**不**自己兜异常：取流那几步抛出来的
 * 错误要一路交给统一错误处理层去弹卡片。可预期的「录不到」是用返回值 + 一句话说明
 * 表达的，不是靠抛异常。
 *
 * @param e 消息事件
 * @param platform 已判定好的平台
 * @param url 已从消息里抽出来的直播间链接
 * @returns 文件真的发出去了才是 true
 */
export const recordLiveRoom = async (e, platform, url) => {
    const resolved = await resolveLiveSource(platform, url);
    if (!resolved.ok) {
        await e.reply(resolved.message);
        return false;
    }
    const { source } = resolved;
    const { ms: maxDurationMs, clamped } = resolveMaxDuration(platform === 'douyin' ? Config.douyin.live?.maxDuration : Config.bilibili.live?.maxDuration);
    if (clamped) {
        logger.warn(`[直播录制] 配置的录制时长超过单次上限，已截断到 ${LIVE_RECORD_MAX_DURATION_MS / 1000} 秒`);
    }
    // 目录正常在 `src/index.ts` 启动时就建好了，这里再兜一次：缺目录时 ffmpeg 报的是
    // 一句 ENOENT，和「ffmpeg 没装」在日志上分不开。
    await Common.mkdir(Common.tempDri.video);
    const outputPath = `${Common.tempDri.video}${source.name}_${Date.now()}.${source.suffix}`;
    const seconds = Math.round(maxDurationMs / 1000);
    await e.reply(`开始录制${source.title ? `「${source.title}」` : ''}\n` +
        `画质：${source.qualityName}\n` +
        `时长：${seconds} 秒${clamped ? '（配置值超过单次上限，已截断）' : ''}\n` +
        '录完才会上传，这段时间里本群的其它解析都在排队');
    const result = await recordLiveStream({
        url: source.url,
        outputPath,
        maxDurationMs,
        headers: source.headers
    });
    // `success` 的判据是「盘上有没有字节」而不是 ffmpeg 怎么退出的，所以走到这里
    // 就是真的一个字节都没录到：FFmpeg 没装、主播中途关播、或者拉流被 CDN 拒了。
    if (!result.success) {
        await e.reply('录制失败，一个字节都没拉到。检查 FFmpeg 是否可用，或者主播是不是已经关播了');
        return false;
    }
    const sizeMB = await Common.getVideoFileSize(result.filePath);
    // 这道闸必须在调用点自己判：`uploadFile` 里没有体积门（`downloadVideo` 那道
    // `usefilelimit` 判断在它自己函数体内，这条路不经过它）。默认配置注释里写的
    // 「超过视频拦截阈值的部分在上传环节会被直接拒掉」指的就是这里。
    // 不判的话用户等满五分钟只换来一次静默的发送失败。
    if (Config.upload.usefilelimit && Config.upload.filelimit && sizeMB > Config.upload.filelimit) {
        await Common.removeFile(result.filePath, true);
        await e.reply(`录好了 ${sizeMB.toFixed(1)}MB，但超过「视频上传拦截阈值」（${Config.upload.filelimit}MB），已删掉。\n` +
            '把录制时长调小、或者把阈值调大再试');
        return false;
    }
    // useGroupFile 照 `downloadVideo` 的算法给：消息内嵌视频段在 ICQQ / OneBot v11 上
    // 约 102MB 见顶、QQBot 约 75MB，而「原画档录几分钟」轻松越过这条线。
    // 传 false 只表示「不强制」，用户自己配的 usegroupfile 仍然生效（uploadFile 里取或）。
    //
    // 媒体度量在体积闸之后、发送之前上报，和 bilibili.ts 那处同一个位置：超限那条分支
    // 上面已经 return，文件压根没发出去，不该计入统计。
    // durationMs 用的是录制这一段的墙上时间（recordLiveStream 自己算的），
    // 而不是流的时间戳时长 —— `-t` 收口的录像这两者只差一个 ffmpeg 启动的量级。
    reportMedia({
        kind: 'video',
        durationMs: fromMilliseconds(result.durationMs),
        bytes: result.bytes
    });
    const sent = await uploadFile(e, {
        filepath: result.filePath,
        // 这一层的 totalBytes 单位是 MB，不是字节（见 `FileInfo` 的用法）
        totalBytes: sizeMB,
        originTitle: `${source.name}.${source.suffix}`
    }, '');
    if (!sent) {
        await e.reply(`录像已落盘（${sizeMB.toFixed(1)}MB），但没能发出去，具体原因看日志`);
    }
    return sent;
};
