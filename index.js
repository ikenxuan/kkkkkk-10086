import { Init, Config } from './module/utils/index.js'
import amagi from '@ikenxuan/amagi'

const apps = await Init().catch(error => logger.error(error))
export { apps }


logger.info('---------- ₍˄·͈༝·͈˄*₎◞ ̑̑ -----------')
logger.info('kkkkkk-10086初始化~')
logger.info('交流群：795874649')
logger.info('Created By ikenxuan')
logger.info('---------------------------------')

const client = new amagi({
  douyin: Config.cookies.douyin,
  bilibili: Config.cookies.bilibili
})

if (Config.app.APIServer) client.startClient(Config.app.APIServerPort)
