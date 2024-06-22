import { Version } from '#components'

const makeForwardMsg = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('#Karin')).common.makeForward
    case 'Miao-Yunzai V4':
      return (await import('yunzai/core')).makeForwardMsg
    default:
      return (await import('../../../../lib/common/common.js')).default.makeForwardMsg
  }
})()

export default makeForwardMsg
