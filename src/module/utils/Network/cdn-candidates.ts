/**
 * 挑下一个还没试过的候选地址。
 *
 * 「试过」按**地址**算而不是按主机算：B站 的 `backup_url` 里同一个主机可能给出
 * 不同路径的两条地址，把主机拉黑会把还没试的那条也一起丢掉。
 *
 * @param candidates 排序后的候选地址
 * @param tried 已经试过的地址
 * @returns 下一个能试的地址；都试过了返回 undefined
 */
export const nextCdnCandidate = (
  candidates: readonly string[],
  tried: ReadonlySet<string>
): string | undefined => candidates.find(url => !tried.has(url))

/**
 * 剩下还没试过的候选地址，保持原有次序。
 *
 * 给测速用：已经试过并失败的地址没有测的价值，把它们一起交给测速等于花时间
 * 给已知的坏节点排名。
 *
 * @param candidates 排序后的候选地址
 * @param tried 已经试过的地址
 */
export const nextCdnCandidates = (
  candidates: readonly string[],
  tried: ReadonlySet<string>
): string[] => candidates.filter(url => !tried.has(url))

/** 只取主机名给日志用。整条下载地址带着签名参数，打进日志既长又没有可读性。 */
export const readUrlHost = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
