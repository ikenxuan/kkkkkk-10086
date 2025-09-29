import fs from 'fs'
import Client from '@ikenxuan/amagi'
import Config from './module/utils/Config.js'
import Common from './module/utils/Common.js'
import Version from './module/utils/Version.js'

// 初始化数据库
const { initAllDatabases } = await import('./module/db/index.js')
await initAllDatabases()

// 定义需要创建的目录
const dirs = [
  Common.tempDri.images,
  Common.tempDri.video
]

// 并行创建所有目录
Promise.all(dirs.map(dir => Common.mkdir(dir)))
  .then(() => logger.info('所有目录创建成功'))
  .catch(e => logger.error('创建目录失败', e))

// 确保Config完全初始化后再加载apps
/** @type {Record<string, any>} */
let apps = {}

// 加载apps
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
