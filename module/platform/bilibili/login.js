import { Common, Config } from '../../utils/index.js'
import { getBilibiliData } from '@ikenxuan/amagi'
import * as QRCode from 'qrcode'
import fs from 'node:fs'


/** B站登录 */
/**
 * 处理哔哩哔哩登录流程
 * @param {*} e - 消息对象
 */
export const bilibiliLogin = async (e) => {
  /** 申请二维码 */
  const qrcodeurl = await getBilibiliData('申请二维码', { typeMode: 'strict' }) // 获取二维码URL
  const qrimg = await QRCode.toDataURL(qrcodeurl.data.data.url) // 将二维码URL转换为base64图片
  const base64Data = qrimg ? qrimg.replace(/^data:image\/\w+;base64,/, '') : '' // 提取base64数据
  const buffer = Buffer.from(base64Data, 'base64') // 将base64数据转换为Buffer
  fs.writeFileSync(`${Common.tempDri.default}BilibiliLoginQrcode.png`, new Uint8Array(buffer)) // 将二维码图片保存到临时目录

  const qrcode_key = qrcodeurl.data.data.qrcode_key // 获取二维码的key
  /** @type {(string | number | undefined)[]} */
  const messageIds = [] // 存储消息ID的数组

  // 发送免责声明和二维码
  const disclaimerMsg = await e.reply('免责声明:\n您将通过扫码完成获取哔哩哔哩网页端的用户登录凭证（ck），该ck将用于请求哔哩哔哩WEB API接口。\n本BOT不会上传任何有关你的信息到第三方，所配置的 ck 只会用于请求官方 API 接口。\n我方仅提供视频解析及相关哔哩哔哩内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码 ~') // 发送免责声明
  const qrcodeMsg = await e.reply([ // 发送二维码图片和提示文字
    segment.image(qrimg?.split(';')[1]?.replace('base64,', 'base64://') || ''),
    '请在120秒内通过哔哩哔哩APP扫码进行登录'
  ], { reply: true })

  messageIds.push(disclaimerMsg?.messageId, qrcodeMsg?.messageId) // 将消息ID存入数组

  /**
   * 批量撤回消息
   */
  const recallMessages = async () => {
    await Promise.all(messageIds.filter(id => id).map(async (id) => {
      try {
        await e.bot.recallMsg(e, id)
      } catch { }
    }))
  }

  /**
   * 处理登录成功
   * @param {any} responseData - 登录响应数据
   */
  const handleLoginSuccess = async (responseData) => {
    Config.modify('cookies', 'bilibili', Array.isArray(responseData.data.data.headers['set-cookie'])
      ? responseData.data.data.headers['set-cookie'].join('; ')
      : responseData.data.data.headers['set-cookie'])
    await e.reply('登录成功！用户登录凭证已保存至cookies.yaml', { reply: true })
    await recallMessages()
  }

  /**
   * 处理二维码已扫描但未确认
   */
  const handleQrScanned = async () => {
    const scannedMsg = await e.reply('二维码已扫码，未确认', { reply: true })
    messageIds.push(scannedMsg?.messageId)

    // 撤回原二维码消息
    try {
      if (qrcodeMsg?.messageId) {
        await e.bot.recallMsg(e, qrcodeMsg.messageId)
      }
    } catch { }

    // 从消息ID列表中移除已撤回的消息
    const index = messageIds.indexOf(qrcodeMsg?.messageId)
    if (index > -1) {
      messageIds.splice(index, 1)
    }
  }

  /**
   * 处理二维码失效
   */
  const handleQrExpired = async () => {
    await e.reply('二维码已失效', { reply: true })
    await recallMessages()
  }

  /** 轮询二维码状态 */
  let hasScanned = false

  while (true) {
    try {
      const qrcodeStatusData = await getBilibiliData('二维码状态', { qrcode_key, typeMode: 'strict' })
      const statusCode = qrcodeStatusData.data.data.data.code

      switch (statusCode) {
        case 0: // 登录成功
          await handleLoginSuccess(qrcodeStatusData)
          return

        case 86038: // 二维码失效
          await handleQrExpired()
          return

        case 86090: // 二维码已扫描，未确认
          if (!hasScanned) {
            await handleQrScanned()
            hasScanned = true
          }
          break

        case 86101: // 未扫描
        default:
          // 继续轮询
          break
      }

      await Common.sleep(3000)
    } catch (error) {
      console.error('轮询二维码状态时发生错误:', error)
      await e.reply('登录过程中发生错误，请重试', { reply: true })
      await recallMessages()
      return
    }
  }
}
