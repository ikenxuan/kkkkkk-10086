import { Version } from '#components'
import { Bot } from '#lib'

/** 发送主动消息
 * @param {number|string} uin 发送者qq
 * @param {number|string} group_id 发送的群号
 * @param {string|number|[]|object} elements
 */
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
    default:
      return (uin, group_id, elements) => {
        return Bot[uin].pickGroup(Number(group_id)).sendMsg(elements)
      }
  }
})()

export default sendMsg
