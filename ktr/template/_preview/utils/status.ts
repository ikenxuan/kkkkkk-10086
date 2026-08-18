import type { PreviewState } from '../types'
import { formatDuration } from './time'

export const buildStatus = (state: PreviewState): { statusText: string; countdownText: string } => {
  const filePath = state.filePath || state.filename
  if (!state.removeCache) {
    return {
      statusText: `文件 ${filePath} 不会自动删除`,
      countdownText: '不删除'
    }
  }
  if (state.removed) {
    return {
      statusText: `文件 ${filePath} 已删除`,
      countdownText: '00:00'
    }
  }
  if (state.remainingMs === null) {
    return {
      statusText: `文件 ${filePath} 将在未知时间后删除`,
      countdownText: '--:--'
    }
  }
  const countdownText = formatDuration(state.remainingMs)
  return {
    statusText: `文件 ${filePath} 将在 ${countdownText} 后删除`,
    countdownText
  }
}
