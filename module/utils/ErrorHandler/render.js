import { Render } from '../Render.js'
import Version from '../Version.js'

const toPlainError = (error) => ({
  name: error?.name || 'Error',
  message: error?.message || String(error),
  stack: error?.stack || ''
})

export const buildErrorMessage = (ctx) => {
  const error = toPlainError(ctx.error)
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

export const renderErrorReport = async (ctx) => {
  const error = toPlainError(ctx.error)
  const groupId = ctx.event?.group_id || ctx.event?.groupId || 'private'
  const userId = ctx.event?.user_id || ctx.event?.userId || ctx.event?.sender?.user_id || 'unknown'

  try {
    return await Render('other/handlerError', {
      type: 'business_error',
      platform: ctx.options.platform || 'unknown',
      method: ctx.options.businessName,
      timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
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
        { level: 'INFO', message: `群: ${groupId}`, raw: `群: ${groupId}` },
        { level: 'INFO', message: `用户: ${userId}`, raw: `用户: ${userId}` }
      ]
    })
  } catch (renderError) {
    logger.warn(`[ErrorHandler] 错误图片渲染失败，使用文本回退: ${renderError?.message || renderError}`)
    return buildErrorMessage(ctx)
  }
}
