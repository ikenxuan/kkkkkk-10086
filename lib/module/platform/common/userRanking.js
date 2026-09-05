/**
 * `statistics/group` 契约里「用户排行」那一块的组装逻辑。
 *
 * 单独放一个模块而不是塞进 `apps/statistics.ts`：跟同目录的 `pushList.ts` 一个路子——
 * 一个模板数据块一个文件，命令处理函数只负责调一次。这样昵称解析能单独测，
 * 也不用为了加这个功能往命令文件里再堆一套宿主对象的类型声明。
 */
import { isRecord } from '../../../module/utils/record.js';
import { qqUserAvatarUrl } from '../../../module/utils/avatar.js';
/**
 * 群名片（`card`）优先于昵称（`nickname`）：这是宿主一贯的显示顺序，
 * 群里看到的就是名片。`name` 是给那些既不给 card 也不给 nickname 的适配器兜底的，
 * 取名思路跟 `apps/statistics.ts` 里 `readGroupName` 的
 * `group_name || groupName || name` 一致。
 */
const readMemberName = (info) => {
    if (!isRecord(info))
        return '';
    return String(info.card || info.nickname || info.nick || info.name || '');
};
/**
 * 昵称查不到时的回落显示。
 *
 * QQ 的 uin 最长 10 位（uint32 上限 4294967295），所以阈值设到 14 位就保证
 * 任何真实 QQ 号都原样显示、绝不会被截。会走到截断分支的只有 QQBot 适配器的
 * openid 那种几十位十六进制串——它在这张卡里查不到昵称是常态（openid 是
 * 每个机器人各自一套的匿名 ID，压根不在群成员表里），整串铺出来会把
 * 排行那一行撑爆，所以掐成「头 6 位…尾 4 位」。
 * 保留尾部是为了区分度：openid 前缀经常相同，只留头部会让好几行看起来一模一样。
 */
const shortenUserId = (userId) => userId.length > 14 ? `${userId.slice(0, 6)}…${userId.slice(-4)}` : userId;
/**
 * 判定方式与 `pushList.ts` 的 `groupAvatarUrl` 一致：只有纯数字的 ID 才是 QQ 号，
 * 其它（QQBot 的 openid 等）拿不到头像就返回 undefined，让契约里那个可选字段缺席，
 * 模板那格整个不渲染，而不是塞一个必然 404 的地址进去。
 */
const userAvatarUrl = (userId) => qqUserAvatarUrl(userId);
/**
 * 造一个「用户号 -> 昵称」的同步查询函数。
 *
 * 为什么先快照 `gml` 再查，而不是逐个 `pickMember().getInfo()`：
 * - `Bot.gml` 是个 getter，宿主 `lib/bot.js` 每次访问都会遍历所有 Bot、
 *   把每个群的成员表重建一遍（`new Map(i)`）。排行有十行，逐行访问就是十次全量重建；
 *   快照一次之后每次查询都是纯内存 O(1)。
 * - `pickMember().getInfo()` 是真发请求（OneBotv11 适配器走
 *   `sendApi('get_group_member_info')`）。为十个人串十次 RPC 会把出图拖到几秒，
 *   并发发又可能触发适配器限流，而这只是为了一行昵称。
 *   `apps/statistics.ts` 里查群名时已经因为同样的理由选了 `gl` 而不是 RPC，
 *   这里沿用同一套取舍。
 * - 代价是 `gml` 只是缓存：宿主要开 `cfg.bot.cache_group_member`、或者这个群的成员
 *   被拉取过，表里才有人。查不到就回落显示（截断的）userId——排行的次数是准的，
 *   只是名字不好看，不会因为一个昵称拿不到就让整张卡出不来。
 *
 * @param e 收到命令的事件，用来先查这个 Bot 自己的成员表
 * @param groupId 要查的群号
 */
const createMemberNameResolver = (e, groupId) => {
    // 先查收到命令的那个 Bot，再退回宿主聚合的全量表：多 Bot 场景下统计表里
    // 可能有只在别的 Bot 才见过的成员。
    //
    // 全局 Bot 走 `as unknown as` 两步断言的原因同 `apps/statistics.ts`：
    // 宿主的全局声明跟 `{ gml?: ... }` 交叉会让 TS 报 TS2589「类型实例化过深」。
    const hostBot = globalThis.Bot;
    // 群号也要按宿主 `pickGroup()` 的方式归一化（`Number(id) || id`）：
    // icqq 的 gml 键是 number，QQBot 的是 string，两种都得试。
    const groupKeys = [groupId, Number(groupId) || groupId];
    const memberMaps = [e.bot?.gml, hostBot?.gml]
        .filter((map) => map instanceof Map)
        .flatMap(map => groupKeys.map(key => map.get(key)))
        .filter((map) => map instanceof Map);
    return (userId) => {
        // 用户号同样两种键都试，宿主 `pickFriend()` 也是这么归一化的
        const userKeys = [userId, Number(userId) || userId];
        for (const members of memberMaps) {
            for (const key of userKeys) {
                const name = readMemberName(members.get(key));
                if (name)
                    return name;
            }
        }
        return '';
    };
};
/**
 * 把 `getGroupUserRanking()` 的聚合结果补上昵称 / 头像，装成契约要的形状。
 *
 * 全程同步、不发请求，所以不存在「某个用户查失败拖累其他人」的情况——
 * 昵称查不到只是这一行回落成截断的 userId，次数照常显示。
 *
 * @param e 收到命令的事件
 * @param groupId 群号
 * @param rows `StatisticsDBBase.getGroupUserRanking()` 的返回值，已按次数降序
 */
export const buildGroupUserRanking = (e, groupId, rows) => {
    const resolveName = createMemberNameResolver(e, groupId);
    return rows.map(row => ({
        userId: row.userId,
        nickname: resolveName(row.userId) || shortenUserId(row.userId),
        totalParses: row.totalParses,
        avatar: userAvatarUrl(row.userId),
        platforms: {
            douyin: row.douyin,
            bilibili: row.bilibili,
            kuaishou: row.kuaishou,
            xiaohongshu: row.xiaohongshu
        }
    }));
};
