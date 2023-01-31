  /**
     * @description: //发送转发消息
     * @param {*} e oicq
     * @param {Array} message 发送的消息
     * @param {Object} data 发送的消息
     * @param {Number} data.recallMsg  撤回时间
     * @param {Boolean} data.isBot 转发信息是否以bot信息发送
     * @param {String} data.fkmsg 风控消息不传则默认消息
     * @param {Boolean} data.isxml 是否处理卡片
     * @param {Boolean} data.oneMsg 是否只有一条消息
     * @return {Object} 消息是否发送成功的对象
     */
  export async function getforwardMsg (e, message, { recallMsg = 0, isBot = true, fkmsg = '', isxml = false, oneMsg = false } = {}) {
    let forwardMsg = []
    let add = (msg) => forwardMsg.push(
      {
        message: msg,
        nickname: isBot ? Bot.nickname : e.sender.card || e.sender.nickname,
        user_id: isBot ? Bot.uin : e.sender.user_id
      }
    )
    oneMsg ? add(message) : message.forEach(item => add(item))
    // 发送
    if (e.isGroup) {
      forwardMsg = await e.group.makeForwardMsg(forwardMsg)
    } else {
      forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
    }
    if (isxml) {
      // 处理转发卡片
      forwardMsg.data = forwardMsg.data
        .replace('<?xml version="1.0" encoding="utf-8"?>', '<?xml version="1.0" encoding="utf-8" ?>')
        .replace(/\n/g, '')
        .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
        .replace(/___+/, '<title color="#777777" size="26">涩批(//// ^ ////)</title>')
    }
    // 发送消息
    let res = await e.reply(forwardMsg, false, { recallMsg })
    if (!res) await e.reply(fkmsg || '消息发送失败，可能被风控')
    return res
  }
