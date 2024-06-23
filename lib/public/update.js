import fs from 'fs'
import path from 'path'
import { logger } from '#lib'
import { pathToFileURL } from 'url'
import { Version } from '#components'
const _path = process.cwd()

const Update = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('#Karin')).Update
    default:
      const v3UpdatePath = path.join(_path, 'plugins/other/update.js')
      const v4UpdatePath = path.join(_path, 'plugins/system-plugin/apps/update.ts')
      if (fs.existsSync(v4UpdatePath)) {
        const updateUrl = pathToFileURL(v4UpdatePath).href
        const { update: Update } = await import(updateUrl)
        return Update
      } else if (fs.existsSync(v3UpdatePath)) {
        const updateUrl = pathToFileURL(v3UpdatePath).href
        const { update: Update } = await import(updateUrl)
        return Update
      } else {
        throw new Error('未安装system(https://github.com/yoimiya-kokomi/Miao-Yunzai/tree/system)，无法提供本体更新支持，请安装后重试！')
      }
  }
})()

export default Update
