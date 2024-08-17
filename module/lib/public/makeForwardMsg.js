import  Version  from '../../components/Version.js'
import { common } from '#lib'

const makeForwardMsg = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return async (e, elements) => {
        return common.makeForward(elements, e.self_id, e.sender.name || e.sender.nick)
      }
    case 'yunzai':
      return (await import('yunzai')).makeForwardMsg
    default:
      return (await import('../../../../../lib/common/common.js')).default.makeForwardMsg
  }
})()

export default makeForwardMsg
