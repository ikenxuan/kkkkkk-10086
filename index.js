import { Version, Init, Config } from '#components'
import { logger } from '#lib'
import amagi, { StartClient } from '@ikenxuan/amagi'

const { Instance } = await new amagi({
  douyin: Config.cookies.douyin,
  bilibili: Config.cookies.bilibili
}).initServer(Config.app.APIServerLog)

if (Config.app.APIServer) await StartClient(Instance, Config.app.APIServerPort)


export const apps = await Init().catch(error => logger.error(error))

if (Version.BotName === 'Karin') {
  logger.info(`${logger.violet(`[插件:${Version.version}]`)} ${logger.green(Version.pluginName)} 初始化完成~`)
} else {
  logger.info('---------- ₍˄·͈༝·͈˄*₎◞ ̑̑ -----------')
  logger.info('kkkkkk-10086初始化~')
  logger.info('交流群：795874649')
  logger.info('Created By ikenxuan')
  logger.info('---------------------------------')
}
