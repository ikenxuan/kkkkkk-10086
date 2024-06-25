import { Version, Init } from '#components'
import { logger } from '#lib'

export const apps = await new Init().load()

logger.info(`${logger.yellow(`[插件:${Version.version}]`)} ${logger.green(Version.pluginName)} 初始化完成~`)
logger.info('交流群：795874649')
