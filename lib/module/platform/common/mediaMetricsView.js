/**
 * `statistics/group` 与 `statistics/global` 契约里「媒体统计」那一块的组装逻辑。
 *
 * 单独放一个模块而不是塞进 `apps/statistics.ts`：跟同目录的 `pushList.ts`、
 * `userRanking.ts` 一个路子 —— 一个模板数据块一个文件，命令处理函数只调一次。
 *
 * 这里做的事只有一件：把 `MediaMetricsSummary`（数据库聚合结果）裁成
 * `MediaMetricsView`（模板契约）。两个形状高度重合但不是同一个：
 * - summary 带 `successCount` / `failureCount`，模板只用它们算出来的 `successRate`，
 *   两个原始计数不进契约（模板拿不到也不该显示「失败 3 次」这种内部数字）
 * - summary 的 platforms 值类型是 `MediaMetricsPlatformSummary`，
 *   契约那边是 `MediaMetricsPlatformView`；字段逐一对齐但类型来源不同
 *   （一个在 `src/types/database.ts`，一个在 `ktr/template/types/media-metrics.ts`），
 *   靠这个函数显式搬一次，而不是 `as` 掉 —— 将来任一侧加字段都会在这里编译报错。
 *
 * 返回值是可选的：一条数据都没有时返回 undefined，让契约里那个可选字段缺席，
 * 模板整块不渲染。这比传一个全 0 的对象好 —— 新装用户的 MediaMetrics 表是空的，
 * 全 0 的「媒体总时长 0 秒」会让人以为功能坏了。
 */
/**
 * 把数据库聚合结果裁成模板契约的形状；没有任何数据时返回 undefined。
 *
 * 「没有任何数据」的判定用 `mediaCount === 0 && successCount + failureCount === 0`
 * 而不是只看 mediaCount：纯图文解析（一条媒体都没有）也会记一行成败，
 * 那种情况下成功率仍然有意义，卡片上会只显示成功率和耗时那两颗药丸。
 *
 * @param summary `getGroupMediaSummary()` / `getGlobalMediaSummary()` 的返回值
 */
export const buildMediaMetricsView = (summary) => {
    if (summary.mediaCount === 0 && summary.successCount + summary.failureCount === 0)
        return undefined;
    return {
        mediaCount: summary.mediaCount,
        videoCount: summary.videoCount,
        audioCount: summary.audioCount,
        totalDurationMs: summary.totalDurationMs,
        videoDurationMs: summary.videoDurationMs,
        audioDurationMs: summary.audioDurationMs,
        durationSamples: summary.durationSamples,
        averageDurationMs: summary.averageDurationMs,
        maxDurationMs: summary.maxDurationMs,
        totalBytes: summary.totalBytes,
        averageProcessingMs: summary.averageProcessingMs,
        successRate: summary.successRate,
        platforms: {
            douyin: { ...summary.platforms.douyin },
            bilibili: { ...summary.platforms.bilibili },
            kuaishou: { ...summary.platforms.kuaishou },
            xiaohongshu: { ...summary.platforms.xiaohongshu }
        }
    };
};
