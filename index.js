import { Version, Init } from '#components'
import { logger } from '#lib'

export const apps = await new Init().load()

logger.info('----------- ₍˄·͈༝·͈˄*₎◞ ̑̑ ----------')
logger.info(`${Version.pluginName} ${Version.version}初始化~`)
logger.info('交流群：795874649')
logger.info('Created By ikenxuan')
logger.info('---------------------------------')
