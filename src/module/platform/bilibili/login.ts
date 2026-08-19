import { Common, Config, Render } from '@/module/utils/index'
import { getBilibiliData } from './api.js'
import * as QRCode from 'qrcode'
import fs from 'node:fs'

/** 登录流程使用的事件对象，与 douyin/login.ts 的 DouyinLoginEvent 保持一致 */
export interface BilibiliLoginEvent {
  reply: (message: unknown, quote?: boolean) => Promise<unknown>
  bot?: {
    recallMsg?: (event: unknown, id: unknown) => Promise<unknown>
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * 按路径读取 amagi 响应里的字段。
 *
 * `getBilibiliData` 的返回值是 `unknown`，而旧实现直接写 `resp.data.data.url` 连续取值，
 * 中间层缺失时会抛 TypeError。这里保持「取不到就抛」：申请二维码阶段没有 try/catch，
 * 异常继续向调用方冒泡；轮询阶段的异常仍被循环内的 catch 接住并提示重试。
 */
const readPath = (value: unknown, path: string[]): unknown => {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) {
      throw new TypeError(`B站登录接口返回结构异常：读取 ${path.join('.')} 失败`)
    }
    current = current[key]
  }
  return current
}

/** 读取指定路径上的字符串，类型不符时按结构异常抛出 */
const readString = (value: unknown, path: string[]): string => {
  const found = readPath(value, path)
  if (typeof found !== 'string') {
    throw new TypeError(`B站登录接口返回结构异常：${path.join('.')} 不是字符串`)
  }
  return found
}

/**
 * 取回复消息的 id。
 *
 * 只读 `message_id`：douyin/login.ts 还会回退到 `messageId`，但本文件的旧实现没有，
 * 迁移阶段不改变可撤回消息的范围。
 */
const getMessageId = (msg: unknown): unknown => {
  return isRecord(msg) ? msg.message_id : undefined
}

/**
 * 处理哔哩哔哩登录流程
 * @param e 消息对象
 */
export const bilibiliLogin = async (e: BilibiliLoginEvent): Promise<void> => {
  /** 申请二维码 */
  const qrcodeurl = await getBilibiliData('申请二维码', { typeMode: 'strict' }) // 获取二维码URL
  const shareUrl = readString(qrcodeurl, ['data', 'data', 'url'])
  const qrimg = await QRCode.toDataURL(shareUrl) // 将二维码URL转换为base64图片
  const base64Data = qrimg ? qrimg.replace(/^data:image\/\w+;base64,/, '') : '' // 提取base64数据
  const buffer = Buffer.from(base64Data, 'base64') // 将base64数据转换为Buffer
  fs.writeFileSync(`${Common.tempDri.default}BilibiliLoginQrcode.png`, new Uint8Array(buffer)) // 将二维码图片保存到临时目录

  const qrcode_key = readString(qrcodeurl, ['data', 'data', 'qrcode_key']) // 获取二维码的key
  const messageIds: unknown[] = [] // 存储消息ID的数组

  // 发送免责声明和二维码
  const disclaimerMsg = await e.reply('免责声明:\n您将通过扫码完成获取哔哩哔哩网页端的用户登录凭证（ck），该ck将用于请求哔哩哔哩WEB API接口。\n本BOT不会上传任何有关你的信息到第三方，所配置的 ck 只会用于请求官方 API 接口。\n我方仅提供视频解析及相关哔哩哔哩内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码 ~') // 发送免责声明
  const qrcodeMsg = await e.reply(
    await Render('bilibili/qrcodeImg', { share_url: shareUrl }),
    true
  )

  const qrcodeMsgId = getMessageId(qrcodeMsg)
  messageIds.push(getMessageId(disclaimerMsg), qrcodeMsgId) // 将消息ID存入数组

  /**
   * 批量撤回消息
   */
  const recallMessages = async (): Promise<void> => {
    await Promise.all(messageIds.filter(id => id).map(async (id) => {
      try {
        await e.bot?.recallMsg?.(e, id)
      } catch { }
    }))
  }

  /**
   * 处理登录成功
   * @param responseData 登录响应数据
   */
  const handleLoginSuccess = async (responseData: unknown): Promise<void> => {
    const setCookie = readPath(responseData, ['data', 'data', 'headers', 'set-cookie'])
    Config.modify('cookies', 'bilibili', Array.isArray(setCookie)
      ? setCookie.join('; ')
      : setCookie)
    await e.reply('登录成功！用户登录凭证已保存至cookies.yaml', true)
    await recallMessages()
  }

  /**
   * 处理二维码已扫描但未确认
   */
  const handleQrScanned = async (): Promise<void> => {
    const scannedMsg = await e.reply('二维码已扫码，未确认', true)
    messageIds.push(getMessageId(scannedMsg))

    // 撤回原二维码消息
    try {
      if (qrcodeMsgId) {
        await e.bot?.recallMsg?.(e, qrcodeMsgId)
      }
    } catch { }

    // 从消息ID列表中移除已撤回的消息
    const index = messageIds.indexOf(qrcodeMsgId)
    if (index > -1) {
      messageIds.splice(index, 1)
    }
  }

  /**
   * 处理二维码失效
   */
  const handleQrExpired = async (): Promise<void> => {
    await e.reply('二维码已失效', true)
    await recallMessages()
  }

  /** 轮询二维码状态 */
  let hasScanned = false

  while (true) {
    try {
      const qrcodeStatusData = await getBilibiliData('二维码状态', { qrcode_key, typeMode: 'strict' })
      const rawStatusCode = readPath(qrcodeStatusData, ['data', 'data', 'data', 'code'])
      // 旧实现用 switch 严格比较数字，非数字一律落到 default（继续轮询），这里保持一致
      const statusCode = typeof rawStatusCode === 'number' ? rawStatusCode : undefined

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
      await e.reply('登录过程中发生错误，请重试', true)
      await recallMessages()
      return
    }
  }
}
