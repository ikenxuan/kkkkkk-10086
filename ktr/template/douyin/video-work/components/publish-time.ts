import { formatDistanceToNow, fromUnixTime } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const UNKNOWN_PUBLISH_TIME = '发布时间未知'

export const formatDouyinPublishTime = (timestamp: unknown): string => {
  const value = typeof timestamp === 'number'
    ? timestamp
    : typeof timestamp === 'string' && timestamp.trim()
      ? Number(timestamp)
      : Number.NaN

  if (!Number.isFinite(value) || value <= 0) return UNKNOWN_PUBLISH_TIME

  const seconds = value >= 100_000_000_000 ? value / 1000 : value
  const date = fromUnixTime(seconds)
  if (!Number.isFinite(date.getTime())) return UNKNOWN_PUBLISH_TIME

  try {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: zhCN
    })
  } catch {
    return UNKNOWN_PUBLISH_TIME
  }
}
