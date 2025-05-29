import { Config, Version } from './module/utils/index.js'
import amagi from '@ikenxuan/amagi'
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

const client = new amagi({
  douyin: Config.cookies.douyin,
  bilibili: Config.cookies.bilibili
})

if (Config.app.APIServer) client.startClient(Config.app.APIServerPort)
