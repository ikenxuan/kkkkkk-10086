import { Version } from '#components'

const common = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('node-karin')).common
    case 'Miao-Yunzai V4':
      return await import('yunzai/core')
    default:
      return (await import('../../../../lib/common/common.js')).default
  }
})()

export default common
