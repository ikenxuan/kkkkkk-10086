import { Render } from '@/module/utils/Render'
import Version from '@/module/utils/Version'
import { formatBuildTime } from '@/module/tooling/build-metadata'
import type { ErrorHandlerContext } from './strategy.js'

export interface NormalizedError {
  name: string
  message: string
  stack: string
}

export const normalizeError = (error: unknown): NormalizedError => ({
  name: getErrorProperty(error, 'name') || 'Error',
  message: getErrorProperty(error, 'message') || stringifyUnknown(error),
  stack: getErrorProperty(error, 'stack') || ''
})

/**
 * 平台名收窄成错误卡片契约认的那几个。
 *
 * 我们的 `Platform` 多一个 `xiaohongshu`，而契约那份 `ApiErrorData['platform']` 只有
 * douyin / bilibili / kuaishou / system / unknown —— 已核对上游同名文件，上游本来就没加，
 * 而 ktr/ 是上游镜像目录，不在这边改。
 *
 * 模板压根没渲染这个字段（只渲染 `adapterInfo.platform`），落到 'unknown' 不影响出图。
 * 刻意不写返回类型标注：契约类型在 ktr/ 里，src/ 这个 program 的 rootDir 是 ./src，
 * 引进来就是 TS6059，手抄一份联合类型早晚漂移，交给 TS 从 case 分支推断。
 * 等上游补上这个成员，这个函数直接删掉即可。
 */
export const toErrorCardPlatform = (platform: string | undefined) => {
  switch (platform) {
    case 'douyin':
    case 'bilibili':
    case 'kuaishou':
    case 'system':
      return platform
    default:
      return 'unknown' as const
  }
}

/**
 * 群 / 用户这类合成条目不是真日志行，没有发生时刻，所以时间戳给空串。
 *
 * 契约里 `LogEntry.timestamp` 是必填 string，而模板那边是 `log.timestamp ? <legend> : null`，
 * 空串走的正是「不渲染时间胶囊」这条分支 —— 和现在线上的表现一模一样，
 * 只是把「字段缺失」换成了「字段为空」，契约就能过。
 */
export const buildContextLogEntries = (groupId: string | number, userId: string | number) => [
  { timestamp: '', level: 'INFO' as const, message: `群: ${groupId}`, raw: `群: ${groupId}` },
  { timestamp: '', level: 'INFO' as const, message: `用户: ${userId}`, raw: `用户: ${userId}` }
]

export const buildErrorMessage = (ctx: ErrorHandlerContext): string => {
  const error = normalizeError(ctx.error)
  const groupId = ctx.event?.group_id || ctx.event?.groupId || 'private'
  const userId = ctx.event?.user_id || ctx.event?.userId || ctx.event?.sender?.user_id || 'unknown'

  return [
    `KKK业务执行出错: ${ctx.options.businessName}`,
    `错误: ${error.name}: ${error.message}`,
    `群: ${groupId}`,
    `用户: ${userId}`,
    `插件: ${Version.pluginName}@${Version.version}`,
    error.stack ? `堆栈:\n${error.stack.split('\n').slice(0, 8).join('\n')}` : ''
  ].filter(Boolean).join('\n')
}

export const renderErrorReport = async (ctx: ErrorHandlerContext): Promise<unknown> => {
  const error = normalizeError(ctx.error)
  const groupId = ctx.event?.group_id || ctx.event?.groupId || 'private'
  const userId = ctx.event?.user_id || ctx.event?.userId || ctx.event?.sender?.user_id || 'unknown'

  try {
    return await Render('other/handlerError', {
      type: 'business_error',
      platform: toErrorCardPlatform(ctx.options.platform),
      method: ctx.options.businessName,
      timestamp: new Date().toISOString(),
      triggerCommand: ctx.event?.msg || '',
      frameworkVersion: Version.BotVersion,
      pluginVersion: Version.version,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        businessName: ctx.options.businessName
      },
      logs: [
        ...ctx.logs.slice().reverse(),
        ...buildContextLogEntries(groupId, userId)
      ],
      buildTime: ctx.buildMetadata?.buildTime ? formatBuildTime(ctx.buildMetadata.buildTime) : undefined,
      commitHash: ctx.buildMetadata?.shortCommitHash || ctx.buildMetadata?.commitHash,
      adapterInfo: ctx.adapterInfo
    })
  } catch (renderError: unknown) {
    logger.warn(`[ErrorHandler] 错误图片渲染失败，使用文本回退: ${normalizeError(renderError).message}`)
    return buildErrorMessage(ctx)
  }
}

function getErrorProperty (error: unknown, property: keyof NormalizedError): string {
  if (typeof error !== 'object' || error === null) return ''
  try {
    const value = Reflect.get(error, property) as unknown
    return value ? stringifyUnknown(value) : ''
  } catch {
    return ''
  }
}

function stringifyUnknown (value: unknown): string {
  try {
    return String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}
