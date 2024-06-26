import { Version } from '#components'
import { Bot } from '#lib'

const sendMsg = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (uin, group_id, elements) => {
        return Bot.sendMsg(
          uin,
          {
            scene: 'group',
            peer: String(group_id)
          },
          elements
        )
      }
    case 'Miao-Yunzai V4':
      return (uin, group_id, elements) => {
        return Bot.pickGroup(Number(group_id)).sendMsg(elements)
      }
    default:
      return (uin, group_id, elements) => {
        return Bot.pickGroup(Number(group_id)).sendMsg(elements)
      }
  }
})()

export default sendMsg
