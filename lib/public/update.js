import fs from 'fs'
import path from 'path'
import { logger } from '#lib'
import { pathToFileURL } from 'url'
import { Version } from '#components'

const Update = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('#Karin')).Update
    default:
      const v3UpdatePath = path.join(process.cwd(), 'plugins/other/update.js')
      const v4UpdatePath = path.join(process.cwd(), 'plugins/system-plugin/apps/update.ts')
      let updateUrl
      if (fs.existsSync(v4UpdatePath)) {
        updateUrl = pathToFileURL(v4UpdatePath).href
      } else if (fs.existsSync(v3UpdatePath)) {
        updateUrl = pathToFileURL(v3UpdatePath).href
      } else {
        logger.error('未安装system(https://github.com/yoimiya-kokomi/Miao-Yunzai/tree/system)，无法提供本体更新支持，请安装后重试！')
        return false
      }
      const { update: Update } = await import(updateUrl)
      return Update
  }
})()

export default Update