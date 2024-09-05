import Base from './Base.js'
import Version from './Version.js'


export default async function getMessage (e) {
  const botAdapter = await new Base(e).botadapter
  if (Version.BotName === 'Karin') {
    if (e.reply_id) {
      const reply = await e.bot.GetMessage(e.contact, e.reply_id)
      for (const v of reply.elements) {
        if (v.type === 'text' || v.type === 'json') e.msg = v?.text || v?.data
        break
      }
    }
  } else {
    switch (botAdapter) {
      case 'ICQQ': {
        if (e.source) {
          const source = (await e.group.getChatHistory(e.source.seq, 1)).pop()
          for (const v of source.message) {
            if (v.type === 'text' || v.type === 'json') e.msg =  v?.text || v?.data
          }
        }
        break
      }
      case 'LagrangeCore':
      case 'Lagrange.OneBot':
      case 'OneBotv11': {
        const source = e.message.find(msg => msg.type === 'reply')
        if (source) {
          const replyMessage = (await e.bot?.sendApi?.('get_msg', { message_id: source.id }))?.data
          if (replyMessage?.message) {
            for (const val of replyMessage.message) {
              if (val.type === 'text' || val.type === 'json') e.msg = val.data?.text || val.data?.data
              break
            }
          }
        }
        break
      }
    }
  }
  return e.msg
}