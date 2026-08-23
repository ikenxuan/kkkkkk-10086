import { getStatisticsDB, PRIVATE_GROUP_ID } from '../module/db/index.js';
import { buildPushListGroupInfo } from '../module/platform/common/pushList.js';
import { buildGroupUserRanking } from '../module/platform/common/userRanking.js';
import { Render } from '../module/utils/index.js';
const sumPlatformStats = (stats) => Object.values(stats).reduce((sum, count) => sum + count, 0);
const isRecord = (value) => typeof value === 'object' && value !== null;
/** 从一条群信息里取群名 */
const readGroupName = (info) => {
    if (!isRecord(info))
        return '';
    return String(info.group_name || info.groupName || info.name || '');
};
/** 事件自身所在的群号；私聊时为空串 */
const getEventGroupId = (e) => String(e.group_id || e.groupId || '');
/**
 * 造一个「群号 -> 群名」的同步查询函数。
 *
 * 为什么要先快照群列表：`Bot.gl` 是个 getter，宿主 `lib/bot.js` 的 `getGroupMap()`
 * 每次访问都会遍历所有 Bot、把每个群的信息展开重建一整张新 Map。全局统计要查几十个群，
 * 逐个访问就是几十次全量重建；快照一次之后每次查询都是纯内存 O(1)，
 * 一个网络请求都不用发，也就不存在「N 次串行 RPC 把渲染拖死」的问题。
 *
 * 为什么用 `gl` 而不是 `bot.getGroupInfo()`：宿主聚合出来的 `Bot` 上根本没有
 * `getGroupInfo`（`e:/Yunzai/lib/bot.js` 里搜不到），那是 icqq Client 才有的方法，
 * QQBot 适配器把它挂在 `pickGroup()` 返回的群对象和 `bot.sdk` 上。而 `gl` 是每个
 * 适配器都要填的群列表，QQBot 适配器自己解析群名走的就是
 * `data.bot.gl.get(data.group_id)` 这条路（QQBot-Plugin/index.js），本仓也已经在
 * `pickGroup()` 的类型上依赖同一套群列表语义。
 */
const createGroupNameResolver = (e) => {
    const eventGroupId = getEventGroupId(e);
    const eventGroupName = String(e.group_name || e.groupName || '');
    // 先查收到命令的那个 Bot 自己的群列表，再退回宿主聚合的全量列表 ——
    // 多 Bot 场景下统计表里可能有只在别的 Bot 才在的群。
    //
    // 全局 Bot 走 `as unknown as` 两步断言而不是 `globalThis & { Bot?: ... }` 交叉：
    // 宿主的全局声明是 `Bot: Yunzai & Utils & Record<string, Client | undefined>`，
    // 跟它交叉后 TS 要把 `Bot.gl` 解析成 `Map<...> & (Client | undefined)`，
    // 直接报 TS2589「类型实例化过深」。
    const hostBot = globalThis.Bot;
    const maps = [e.bot?.gl, hostBot?.gl]
        .filter((map) => map instanceof Map);
    return (groupId) => {
        /**
         * 捷径：要查的正好就是事件自己所在的那个群。
         *
         * `e.group_name` 是适配器为**当前这条消息所在的群**预先解析好的名字，
         * 因此只有在 `groupId` 等于事件群号时才代表这个群。单群统计
         * （`#kkk解析统计`）查的就是当前群，所以走这条捷径既正确又省一次查询；
         * 但全局统计（`#kkk全局解析统计`）要把统计表里**每一个**群的名字都查出来，
         * 一旦无条件返回 `e.group_name`，排行榜里几十个群号各不相同的群就会全部
         * 顶着「命令发出者所在那个群」的名字 —— 这正是这次要修的 bug。
         */
        if (groupId && groupId === eventGroupId && eventGroupName)
            return eventGroupName;
        // 宿主 `pickGroup()` 就是这么归一化群号的（`Number(group_id) || group_id`）：
        // icqq 的 gl 键是 number，QQBot 的是 string，两种都得试。
        const keys = [groupId, Number(groupId) || groupId];
        for (const map of maps) {
            for (const key of keys) {
                const name = readGroupName(map.get(key));
                if (name)
                    return name;
            }
        }
        // 查不到就交给调用点决定怎么回落，这里不擅自编一个名字出来
        return '';
    };
};
export class kkkStatistics extends plugin {
    constructor() {
        super({
            name: 'kkk解析统计',
            event: 'message',
            priority: 2000,
            rule: [
                {
                    reg: /^#?kkk解析统计$/,
                    fnc: 'groupStatistics'
                },
                {
                    reg: /^#?kkk全局解析统计$/,
                    fnc: 'globalStatistics',
                    permission: 'master'
                }
            ]
        });
    }
    async groupStatistics(e) {
        const groupId = e.group_id || e.groupId;
        if (!groupId) {
            await e.reply('此命令仅支持在群聊中使用');
            return true;
        }
        const statisticsDB = await requireStatisticsDB();
        const groupStats = await statisticsDB.getGroupStatistics(String(groupId));
        const groupUniqueUsers = await statisticsDB.getGroupUniqueUsers(String(groupId));
        const globalSummary = await statisticsDB.getGlobalSummary();
        /**
         * 本群用户解析排行，取前 10 名。
         *
         * 走 SQL 聚合而不是从上面的 `groupStats` 现算：聚合和 `LIMIT` 都压到 SQLite 里，
         * 无论这个群攒了多少行都只回 10 行（理由详见 `getGroupUserRanking()` 的注释）。
         * 昵称由 `buildGroupUserRanking` 从宿主群成员表同步补齐，不发任何请求。
         */
        const userRanking = buildGroupUserRanking(e, String(groupId), await statisticsDB.getGroupUserRanking(String(groupId), 10));
        const platformData = groupStats.reduce((acc, stat) => {
            acc[stat.platform] = (acc[stat.platform] || 0) + stat.parseCount;
            return acc;
        }, { douyin: 0, bilibili: 0, kuaishou: 0, xiaohongshu: 0 });
        const groupTotalParses = sumPlatformStats(platformData);
        /**
         * 群名 / 群头像一起交给推送列表那套现成逻辑收尾：它的 groupName 回落顺序是
         * 「传入的名字 -> 群号 -> 未知群聊」。这里必须有回落，因为模板渲染的是
         * `{groupName}({groupId})`，名字为空串会渲染成一个光秃秃的 `(123456789)`。
         */
        const groupInfo = buildPushListGroupInfo({
            group_id: groupId,
            group_name: createGroupNameResolver(e)(String(groupId))
        });
        const img = await Render('statistics/group', {
            // e.group_id 是宿主的 MessageId（string | number），契约要 string
            groupId: String(groupId),
            groupName: groupInfo.groupName,
            groupAvatar: groupInfo.groupAvatar,
            groupTotalParses,
            groupUniqueUsers,
            // 契约要的是四个平台的原始计数对象，模板自己排版；
            // 原来传的是拼好的 `platformRows` 数组，
            // 契约里没这个键，而必填的 platformData 一直缺着
            platformData,
            globalTotalGroups: globalSummary.totalGroups,
            globalTotalParses: globalSummary.totalParses,
            // 本地新增的可选字段（上游没有）：空数组时模板整块不渲染
            userRanking
        });
        await e.reply(img);
        return true;
    }
    async globalStatistics(e) {
        const statisticsDB = await requireStatisticsDB();
        const history = await statisticsDB.getRecentHistory(30);
        /**
         * 只留真群的记录。
         *
         * 私聊解析在 ParseStatistics 里也占一行，groupId 是占位值 `PRIVATE_GROUP_ID`
         * 而不是群号。模板是拿 `allStats` 里出现过的每一个 groupId 现算「群组排行」和
         * 「服务群组」的（ktr/template/statistics/global），不在这里滤掉，排行榜里就会
         * 多出一行群号写着 `private` 的假群，群数也会被它多算一个。
         *
         * 私聊记录本身仍然照常写库（见 apps/tools.ts 的 recordParseStatistics）：
         * 累计解析数、用户数算它是有意义的，只是不该被当成一个「群」。这里的代价是
         * 本卡片的「总解析 / 使用用户 / 平台分布」也一并只统计群内活动 —— 因为模板把
         * 这几项和群组排行都从同一个 `allStats` 现算，而模板契约里没有第二个字段可以
         * 把「排行用的数据」和「总量用的数据」分开传。真要两者都准，得给
         * GlobalStatisticsData 加一个独立的排行字段，那属于模板侧的改动。
         * 「30 天趋势」走的是 ParseHistory 表，不受这里影响，仍含私聊。
         */
        const allStats = (await statisticsDB.getAllStatistics())
            .filter(stat => stat.groupId !== PRIVATE_GROUP_ID);
        /**
         * 群名 / 群头像映射。模板按 groupId 查这张表给「群组排行」配名字，
         * 查不到就退回显示 `群组 <群号>`，所以拿不到名字的群直接不进表。
         *
         * 解析器只造一次：它内部快照了宿主群列表，之后每个群都是纯内存查询，
         * 整个循环里一次网络请求都没有。
         */
        const resolveGroupName = createGroupNameResolver(e);
        const groupInfoMap = {};
        for (const groupId of new Set(allStats.map(stat => stat.groupId))) {
            groupInfoMap[groupId] = {
                groupName: resolveGroupName(groupId) || undefined,
                groupAvatar: buildPushListGroupInfo({ group_id: groupId }).groupAvatar || undefined
            };
        }
        // 契约要的是三份原始数据，总群数 / 总用户 / 总解析 / 平台分布 / 群组排行
        // 全部由模板从 allStats 现算。原来传的 totalGroups、platformRows、topGroups
        // 这些拼好的结果契约里一个都没有，而必填的 allStats / historyData / groupInfoMap
        // 三个全缺 —— 模板里是 `props.data.allStats.map(...)` 无守卫访问，
        // `#kkk全局解析统计` 一执行就抛 Cannot read properties of undefined
        const img = await Render('statistics/global', {
            allStats,
            historyData: history.reverse(),
            groupInfoMap
        });
        await e.reply(img);
        return true;
    }
}
/**
 * 取统计数据库实例。
 *
 * `getStatisticsDB()` 初始化失败时返回 null，迁移前的代码会在随后的属性访问上抛
 * TypeError；这里把它换成一条能说明原因的错误，抛出时机与传播路径不变。
 */
const requireStatisticsDB = async () => {
    const statisticsDB = await getStatisticsDB();
    if (!statisticsDB)
        throw new Error('解析统计数据库未初始化');
    return statisticsDB;
};
