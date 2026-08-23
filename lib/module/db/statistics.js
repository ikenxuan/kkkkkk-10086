import sqlite3 from 'sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import Version from '../../module/utils/Version.js';
const PLATFORMS = ['douyin', 'bilibili', 'kuaishou', 'xiaohongshu'];
/**
 * ParseStatistics 表里给私聊解析占位的 groupId。
 *
 * 表上有 `UNIQUE(groupId, userId, platform)`，groupId 又是 `NOT NULL`，
 * 而私聊根本没有群号，于是统一写成这个字面量。
 *
 * 它不是群号：凡是按「群」聚合的读取端（全局统计的群组排行、群数统计）
 * 都必须先把它排除掉，否则会凭空多出一个群号写着 `private` 的假群。
 * 写库端和读取端共用这一个常量，避免两边字面量各写一份后悄悄漂移。
 */
export const PRIVATE_GROUP_ID = 'private';
const isStatisticsPlatform = (value) => PLATFORMS.includes(value);
export class StatisticsDBBase {
    db = null;
    dbPath;
    /**
     * @param {string} [dataPath] 数据目录，缺省时使用插件根目录下的 `data`
     */
    constructor(dataPath) {
        this.dbPath = path.join(dataPath ?? path.join(Version.pluginPath, 'data'), 'statistics.db');
    }
    async init() {
        try {
            logger.debug(logger.green('--------------------------[StatisticsDB] 开始初始化数据库--------------------------'));
            await fs.promises.mkdir(path.dirname(this.dbPath), { recursive: true });
            this.db = new sqlite3.Database(this.dbPath);
            await this.createTables();
            await this.initGlobalStatistics();
            await this.syncHistoryFromStats();
            logger.debug(logger.green('--------------------------[StatisticsDB] 初始化数据库完成--------------------------'));
        }
        catch (error) {
            logger.error('[StatisticsDB] 数据库初始化失败:', error);
            throw error;
        }
        return this;
    }
    async createTables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS ParseStatistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        groupId TEXT NOT NULL,
        userId TEXT NOT NULL,
        platform TEXT NOT NULL,
        parseCount INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(groupId, userId, platform)
      )`,
            `CREATE TABLE IF NOT EXISTS ParseHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        totalParses INTEGER DEFAULT 0,
        douyin INTEGER DEFAULT 0,
        bilibili INTEGER DEFAULT 0,
        kuaishou INTEGER DEFAULT 0,
        xiaohongshu INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
            `CREATE TABLE IF NOT EXISTS GlobalStatistics (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`
        ];
        for (const query of queries) {
            await this.runQuery(query);
        }
    }
    async initGlobalStatistics() {
        for (const key of ['totalGroups', 'totalParses']) {
            const exists = await this.getQuery('SELECT * FROM GlobalStatistics WHERE key = ?', [key]);
            if (!exists) {
                await this.runQuery('INSERT INTO GlobalStatistics (key, value, updatedAt) VALUES (?, ?, ?)', [
                    key,
                    '0',
                    new Date().toISOString()
                ]);
            }
        }
    }
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db?.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }
    getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db?.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
    }
    allQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db?.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }
    async recordParse(groupId, userId, platform) {
        if (!isStatisticsPlatform(platform))
            return;
        const now = new Date().toISOString();
        const today = now.split('T')[0] ?? now;
        const existing = await this.getQuery('SELECT * FROM ParseStatistics WHERE groupId = ? AND userId = ? AND platform = ?', [groupId, userId, platform]);
        if (existing) {
            await this.runQuery('UPDATE ParseStatistics SET parseCount = parseCount + 1, updatedAt = ? WHERE groupId = ? AND userId = ? AND platform = ?', [now, groupId, userId, platform]);
        }
        else {
            await this.runQuery('INSERT INTO ParseStatistics (groupId, userId, platform, parseCount, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)', [groupId, userId, platform, now, now]);
            await this.refreshTotalGroups();
        }
        await this.incrementTotalParses();
        await this.updateDailyHistory(today, platform);
    }
    async updateDailyHistory(date, platform) {
        const existing = await this.getQuery('SELECT * FROM ParseHistory WHERE date = ?', [date]);
        if (existing) {
            await this.runQuery(`UPDATE ParseHistory SET totalParses = totalParses + 1, ${platform} = ${platform} + 1 WHERE date = ?`, [date]);
            return;
        }
        await this.runQuery('INSERT INTO ParseHistory (date, totalParses, douyin, bilibili, kuaishou, xiaohongshu, createdAt) VALUES (?, 1, ?, ?, ?, ?, ?)', [
            date,
            platform === 'douyin' ? 1 : 0,
            platform === 'bilibili' ? 1 : 0,
            platform === 'kuaishou' ? 1 : 0,
            platform === 'xiaohongshu' ? 1 : 0,
            new Date().toISOString()
        ]);
    }
    async syncHistoryFromStats() {
        const historyCount = await this.getQuery('SELECT COUNT(*) as count FROM ParseHistory');
        if ((historyCount?.count ?? 0) > 0)
            return;
        const allStats = await this.getAllStatistics();
        const dateMap = new Map();
        for (const stat of allStats) {
            const date = stat.createdAt.split('T')[0] ?? stat.createdAt;
            let platforms = dateMap.get(date);
            if (!platforms) {
                platforms = { douyin: 0, bilibili: 0, kuaishou: 0, xiaohongshu: 0 };
                dateMap.set(date, platforms);
            }
            platforms[stat.platform] += stat.parseCount;
        }
        for (const [date, platforms] of dateMap.entries()) {
            const totalParses = PLATFORMS.reduce((sum, platform) => sum + platforms[platform], 0);
            await this.runQuery('INSERT OR IGNORE INTO ParseHistory (date, totalParses, douyin, bilibili, kuaishou, xiaohongshu, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [date, totalParses, platforms.douyin, platforms.bilibili, platforms.kuaishou, platforms.xiaohongshu, new Date().toISOString()]);
        }
    }
    async getGroupStatistics(groupId) {
        return await this.allQuery('SELECT * FROM ParseStatistics WHERE groupId = ? ORDER BY platform, userId', [groupId]);
    }
    /**
     * 群内用户解析次数排行，按总次数从多到少取前 `limit` 名。
     *
     * 为什么走 SQL 聚合而不是拿 `getGroupStatistics()` 的结果在应用层 reduce：
     * - 建表时的 `UNIQUE(groupId, userId, platform)` 会带一个隐式索引，列序正好是
     *   「groupId 前缀 + userId」，所以 `WHERE groupId = ? GROUP BY userId` 能直接
     *   沿这个索引有序扫过去，SQLite 不用为分组另建临时 B 树。
     * - `LIMIT` 在 SQLite 里生效，跨进程边界只回 `limit` 行；应用层聚合要先把这个群
     *   的全部行读进 JS 堆，再建 Map、再排序，行数随群活跃度无上限增长。
     *
     * 四个平台的分布用 `SUM(CASE WHEN ...)` 一次查完，不再为每个用户补查一次。
     *
     * `ORDER BY` 补了 `userId ASC` 作次级键：次数打平时 SQLite 不保证行序，
     * 少了它同样的数据每次渲染可能排出不同的名次。
     *
     * @param groupId 群号
     * @param limit 取前几名，默认 10
     */
    async getGroupUserRanking(groupId, limit = 10) {
        return await this.allQuery(`SELECT
         userId,
         SUM(parseCount) AS totalParses,
         SUM(CASE WHEN platform = 'douyin' THEN parseCount ELSE 0 END) AS douyin,
         SUM(CASE WHEN platform = 'bilibili' THEN parseCount ELSE 0 END) AS bilibili,
         SUM(CASE WHEN platform = 'kuaishou' THEN parseCount ELSE 0 END) AS kuaishou,
         SUM(CASE WHEN platform = 'xiaohongshu' THEN parseCount ELSE 0 END) AS xiaohongshu
       FROM ParseStatistics
       WHERE groupId = ?
       GROUP BY userId
       ORDER BY totalParses DESC, userId ASC
       LIMIT ?`, [groupId, limit]);
    }
    async getGroupUniqueUsers(groupId) {
        const result = await this.getQuery('SELECT COUNT(DISTINCT userId) as count FROM ParseStatistics WHERE groupId = ?', [groupId]);
        return result?.count || 0;
    }
    async getTotalUniqueUsers() {
        const result = await this.getQuery('SELECT COUNT(DISTINCT userId) as count FROM ParseStatistics');
        return result?.count || 0;
    }
    async getAllStatistics() {
        return await this.allQuery('SELECT * FROM ParseStatistics ORDER BY groupId, platform');
    }
    async getRecentHistory(days = 30) {
        return await this.allQuery('SELECT * FROM ParseHistory ORDER BY date DESC LIMIT ?', [days]);
    }
    async getPlatformTotalParses(platform) {
        const result = await this.getQuery('SELECT SUM(parseCount) as total FROM ParseStatistics WHERE platform = ?', [platform]);
        return result?.total || 0;
    }
    /**
     * 真实群数。
     *
     * 必须排除 `PRIVATE_GROUP_ID`：私聊解析在表里也占一行，
     * 直接 `COUNT(DISTINCT groupId)` 会把「私聊」当成一个群多算一个，
     * 让统计卡片上的「服务群组」比实际群数多 1。
     */
    async getTotalGroups() {
        const result = await this.getQuery('SELECT COUNT(DISTINCT groupId) as count FROM ParseStatistics WHERE groupId != ?', [PRIVATE_GROUP_ID]);
        return result?.count || 0;
    }
    async getTotalParses() {
        // 只投影 value 一列，用整行类型会让 key / updatedAt 在类型上存在、运行时却是 undefined
        const result = await this.getQuery('SELECT value FROM GlobalStatistics WHERE key = ?', ['totalParses']);
        return Number.parseInt(result?.value || '0', 10);
    }
    async refreshTotalGroups() {
        const totalGroups = await this.getTotalGroups();
        await this.runQuery('UPDATE GlobalStatistics SET value = ?, updatedAt = ? WHERE key = ?', [
            String(totalGroups),
            new Date().toISOString(),
            'totalGroups'
        ]);
    }
    async incrementTotalParses() {
        await this.runQuery('UPDATE GlobalStatistics SET value = value + 1, updatedAt = ? WHERE key = ?', [
            new Date().toISOString(),
            'totalParses'
        ]);
    }
    async getGlobalSummary() {
        return {
            totalGroups: await this.getTotalGroups(),
            totalParses: await this.getTotalParses(),
            totalUsers: await this.getTotalUniqueUsers(),
            platformStats: {
                douyin: await this.getPlatformTotalParses('douyin'),
                bilibili: await this.getPlatformTotalParses('bilibili'),
                kuaishou: await this.getPlatformTotalParses('kuaishou'),
                xiaohongshu: await this.getPlatformTotalParses('xiaohongshu')
            }
        };
    }
}
