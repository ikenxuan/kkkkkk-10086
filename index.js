import { Config, Version } from './module/utils/index.js'
import Client from '@ikenxuan/amagi'
import fs from 'fs'

let apps = {}
const files = fs.readdirSync(`${Version.pluginPath}/apps`).filter(file => file.endsWith('.js'))
let ret = []
files.forEach(file => {
  ret.push(import(`./apps/${file}`))
})
ret = await Promise.allSettled(ret)
for (const i in files) {
  const name = files[i].replace('.js', '')

  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error(ret[i].reason)
    continue
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
export { apps }


logger.info('---------- ₍˄·͈༝·͈˄*₎◞ ̑̑ -----------')
logger.info('kkkkkk-10086初始化~')
logger.info('Created By ikenxuan')
logger.info('---------------------------------')

if (Config.app.APIServer) {
  const client = new Client({
    douyin: Config.cookies.douyin,
    bilibili: Config.cookies.bilibili
  })
  client.startClient(Config.app.APIServerPort)
  
  // 记录服务启动信息
  logger.mark('========== HTTP API 服务启动 ==========')
  logger.mark(`服务地址: http://127.0.0.1:${Config.app.APIServerPort}`)
  logger.mark('----------------------------------------')
  logger.mark('已启用的 API 服务:')
  
  // 记录各平台API状态
  if (Config.cookies.douyin) {
    logger.mark('✓ 抖音 API: /api/douyin/...')
  } else {
    logger.mark('✗ 抖音 API: 未配置 Cookie')
  }
  
  if (Config.cookies.bilibili) {
    logger.mark('✓ B站 API: /api/bilibili/...')
  } else {
    logger.mark('✗ B站 API: 未配置 Cookie')
  }
  
  logger.mark('========================================')
}
