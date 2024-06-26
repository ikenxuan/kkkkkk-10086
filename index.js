import { Version, Init } from '#components'
import { logger } from '#lib'

export const apps = await new Init().load()

if (Version.BotName === 'Karin') {
  logger.info(`${logger.violet(`[插件:${Version.version}]`)} ${logger.green(Version.pluginName)} 初始化完成~`)
} else {
  logger.info('---------- ₍˄·͈༝·͈˄*₎◞ ̑̑ -----------')
  logger.info('kkkkkk-10086初始化~')
  logger.info('交流群：795874649')
  logger.info('Created By ikenxuan')
  logger.info('---------------------------------')
}
