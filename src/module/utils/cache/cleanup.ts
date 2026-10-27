/** 清理日志只含错误码，避免路径、消息内容或凭据从异常对象进入日志。 */
export const warnCacheCleanupFailure = (error: unknown): void => {
  const code = typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(error.code)
    ? error.code
    : 'UNKNOWN'
  try {
    globalThis.logger?.warn?.(`[缓存清理] 失败摘要: ${code}，等待后续重试`)
  } catch {
    // 日志或删除失败都不能替换原来的渲染、截图或发送结果。
  }
}
