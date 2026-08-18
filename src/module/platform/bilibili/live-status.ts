const invalidLiveTimes = new Set([
  '',
  '-62170012800',
  '0000-00-00 00:00:00'
])

/** 将 B 站返回的东八区开播时间转换为可比较的 ISO 时间。 */
export const parseBilibiliLiveStartedAt = (liveTime: string): string | null => {
  const normalizedLiveTime = liveTime.trim()
  if (invalidLiveTimes.has(normalizedLiveTime)) return null

  const zonedLiveTime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalizedLiveTime)
    ? `${normalizedLiveTime.replace(' ', 'T')}+08:00`
    : normalizedLiveTime
  const timestamp = Date.parse(zonedLiveTime)
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString()
}

/** 使用 UP、直播间和原始开播时间构造跨检测来源稳定的场次缓存键。 */
export const buildBilibiliLiveSessionId = (
  hostMid: number,
  roomId: number,
  liveTime: string
): string | null => {
  const normalizedLiveTime = liveTime.trim()
  if (!parseBilibiliLiveStartedAt(normalizedLiveTime)) return null
  return `bilibili-live:${hostMid}:${roomId}:${normalizedLiveTime}`
}
