import { Config, Version, logger, Common } from './module/utils/index.js'
import Client from '@ikenxuan/amagi'
import { join } from 'path'
import fs from 'fs'

/** @type {Record<string, any>} */
let apps = {}
const files = fs.readdirSync(`${Version.pluginPath}/apps`).filter(file => file.endsWith('.js'))
/** @type {Promise<any>[]} */
let ret = []
files.forEach(file => {
  ret.push(import(`./apps/${file}`))
})
const results = await Promise.allSettled(ret)
files.forEach((fileName, index) => {
  if (!fileName) return

  const name = fileName.replace('.js', '')
  const result = results[index]

  if (result?.status !== 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    if (result?.status === 'rejected') {
      logger.error(result.reason)
    }
    return
  }
  const moduleKeys = Object.keys(result.value || {})
  const firstKey = moduleKeys[0]
  if (moduleKeys.length > 0 && firstKey && result.value?.[firstKey]) {
    apps[name] = result.value[firstKey]
  }
})
export { apps }

Common.mkdir(join(Version.pluginPath, 'data'))
Common.mkdir(Common.tempDri.images)
Common.mkdir(Common.tempDri.video)


logger.info('---------- ₍˄·͈༝·͈˄*₎◞ ̑̑ -----------')
logger.info('kkkkkk-10086初始化~')
logger.info('Created By ikenxuan')
logger.info('---------------------------------')

if (Config.app.APIServer) {
  const amagiServer = new Client({
    cookies: {
      bilibili: Config.cookies.bilibili,
      douyin: Config.cookies.douyin,
      kuaishou: Config.cookies.kuaishou
    }
  })
  amagiServer.startServer(Config.app.APIServerPort)
}
