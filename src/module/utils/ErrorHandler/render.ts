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
      platform: ctx.options.platform || 'unknown',
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
        { level: 'INFO', message: `群: ${groupId}`, raw: `群: ${groupId}` },
        { level: 'INFO', message: `用户: ${userId}`, raw: `用户: ${userId}` }
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
