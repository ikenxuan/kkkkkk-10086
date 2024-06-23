import fs from 'fs'
import path from 'path'
import { logger } from '#lib'
import { pathToFileURL } from 'url'
import { Version } from '#components'

const Restart = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      const baseRestartPath = path.join(process.cwd(), 'plugins/karin-plugin-basic/apps/restart.js')
      if (fs.existsSync(baseRestartPath)) {
        const restartUrl = pathToFileURL(baseRestartPath).href
        const { restart: Restart } = await import(restartUrl)
        return Restart
      } else {
        logger.error('未安装karin-plugin-basic(https://github.com/KarinJS/karin-plugin-basic/)，无法提供重启支持，请安装后重试！')
        return false
      }
    default:
      const v3RestartPath = path.join(process.cwd(), 'plugins/other/restart.js')
      const v4RestartPath = path.join(process.cwd(), 'plugins/system-plugin/apps/restart.ts')
      let restartUrl
      if (fs.existsSync(v4RestartPath)) {
        restartUrl = pathToFileURL(v4RestartPath).href
      } else if (fs.existsSync(v3RestartPath)) {
        restartUrl = pathToFileURL(v3RestartPath).href
      } else {
        logger.error('未安装system-plugin(https://github.com/yoimiya-kokomi/Miao-Yunzai/tree/system)，无法提供本体重启支持，请安装后重试！')
        return false
      }
      const { restart: Restart } = await import(restartUrl)
      return Restart
  }
})()

export default Restart