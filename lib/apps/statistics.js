import { getStatisticsDB } from '../module/db/index.js';
import { buildPushListGroupInfo } from '../module/platform/common/pushList.js';
import { Render } from '../module/utils/index.js';
const sumPlatformStats = (stats) => Object.values(stats).reduce((sum, count) => sum + count, 0);
const isRecord = (value) => typeof value === 'object' && value !== null;
const getGroupName = async (e, groupId) => {
    if (e.group_name)
        return String(e.group_name);
    try {
        const bot = e.bot;
        const info = await bot?.getGroupInfo?.(groupId);
        if (!isRecord(info))
            return '';
        return String(info.group_name || info.groupName || info.name || '');
    }
    catch {
        return '';
    }
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
        const platformData = groupStats.reduce((acc, stat) => {
            acc[stat.platform] = (acc[stat.platform] || 0) + stat.parseCount;
            return acc;
        }, { douyin: 0, bilibili: 0, kuaishou: 0, xiaohongshu: 0 });
        const groupTotalParses = sumPlatformStats(platformData);
        const img = await Render('statistics/group', {
            // e.group_id 是宿主的 MessageId（string | number），契约要 string
            groupId: String(groupId),
            groupName: await getGroupName(e, String(groupId)),
            groupAvatar: buildPushListGroupInfo({ group_id: groupId }).groupAvatar,
            groupTotalParses,
            groupUniqueUsers,
            // 契约要的是四个平台的原始计数对象，模板自己排版；
            // 原来传的是拼好的 `platformRows` 数组，
            // 契约里没这个键，而必填的 platformData 一直缺着
            platformData,
            globalTotalGroups: globalSummary.totalGroups,
            globalTotalParses: globalSummary.totalParses
        });
        await e.reply(img);
        return true;
    }
    async globalStatistics(e) {
        const statisticsDB = await requireStatisticsDB();
        const history = await statisticsDB.getRecentHistory(30);
        const allStats = await statisticsDB.getAllStatistics();
        /**
         * 群名 / 群头像映射。模板按 groupId 查这张表给「群组排行」配名字，
         * 查不到就退回显示群号，所以拿不到名字的群直接不进表。
         */
        const groupInfoMap = {};
        for (const groupId of new Set(allStats.map(stat => stat.groupId))) {
            groupInfoMap[groupId] = {
                groupName: await getGroupName(e, groupId) || undefined,
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
