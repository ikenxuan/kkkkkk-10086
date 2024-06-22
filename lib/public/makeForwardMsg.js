import { Version } from '#components'
import { common } from '#lib'

const makeForwardMsg = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (e, elements) => {
        return common.makeForward(elements, e.self_id, e.sender.name || e.sender.nick)
      }
    case 'Miao-Yunzai V4':
      return (await import('yunzai/core')).makeForwardMsg
    default:
      return (await import('../../../../lib/common/common.js')).default.makeForwardMsg
  }
})()

export default makeForwardMsg
