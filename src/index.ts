import { loadApps } from './module/loader/index.js'
import Common from './module/utils/Common.js'
import Config from './module/utils/Config.js'

// 初始化数据库
const { initAllDatabases } = await import('@/module/db/index')
await initAllDatabases()

// 定义需要创建的目录
const dirs = [
  Common.tempDri.images,
  Common.tempDri.video
]

// 并行创建所有目录
try {
  await Promise.all(dirs.map(dir => Common.mkdir(dir)))
  logger.info('所有目录创建成功')
} catch (e) {
  logger.error('创建目录失败', e)
}

// 加载apps
const { apps, failedFiles } = await loadApps()
for (const { file, error } of failedFiles) {
  logger.error(`载入插件错误：${file}`, error)
}

export { apps }

logger.info('---------- ₍˄·͈༝·͈˄*₎◞ ̑̑ -----------')
logger.info('kkkkkk-10086初始化~')
logger.info('Created By ikenxuan')
logger.info('交流群：795874649')
logger.info('---------------------------------')

if (Config.app.APIServer) {
  const { startPluginServer } = await import('@/module/server/index')
  startPluginServer()
}
