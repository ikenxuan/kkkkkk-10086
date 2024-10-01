import { Version, Init, Config } from './module/components/index.js'
import logger from './module/lib/public/logger.js'
import amagi from '@ikenxuan/amagi'

let apps
if (Version.BotName !== 'Karin') {
  apps = await Init().catch(error => logger.error(error))
}
export { apps }


if (Version.BotName === 'Karin') {
  logger.info(`${logger.violet(`[插件:${Version.version}]`)} ${logger.green(Version.pluginName)} 初始化完成~`)
} else {
  logger.info('---------- ₍˄·͈༝·͈˄*₎◞ ̑̑ -----------')
  logger.info('kkkkkk-10086初始化~')
  logger.info('交流群：795874649')
  logger.info('Created By ikenxuan')
  logger.info('---------------------------------')
}

const client = new amagi({
  douyin: Config.cookies.douyin,
  bilibili: Config.cookies.bilibili
})

if (Config.app.APIServer) client.startClient(Config.app.APIServerPort)
