import puppeteer from 'puppeteer'
import fs from 'node:fs'
import { Version, Config } from '../../components/index.js'
export const dylogin = async (e) => {
  const msg_id = []
  const message1 = await e.reply('免责声明:\n您将通过扫码完成获取抖音网页端的用户登录凭证（ck），该ck将用于请求抖音WEB API接口。\n本Bot不会保存您的登录状态。\n我方仅提供视频解析及相关抖音内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码 ~')
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--window-position=-10000,-10000', // 将窗口移到屏幕外
      '--start-minimized', // 启动时最小化
      '--mute-audio' // 静音
    ]
  })
  const pages = await browser.pages()
  // 获取第一个页面，如果没有，就创建一个新页面
  const page = pages[0] || (await browser.newPage())
  await page.goto('https://www.douyin.com')

  // 等待二维码容器出现
  await page.waitForSelector('.web-login-scan-code__content__qrcode-wrapper', { timeout: 10000 })

  // 等待 img 元素加载并变得可见
  const qrcodeImage = await page.waitForSelector('.web-login-scan-code__content__qrcode-wrapper img', { timeout: 10000 })

  // 使用 evaluate 获取 img 的 src 属性内容
  const qrCodeBase64 = await page.evaluate(img => img.getAttribute('src'), qrcodeImage)

  // 移除 base64 前缀
  const base64Data = qrCodeBase64 ? qrCodeBase64.replace(/^data:image\/\w+;base64,/, '') : ''
  const buffer = Buffer.from(base64Data, 'base64')
  fs.writeFileSync(`${Version.clientPath}/resources/kkkdownload/DouyinLoginQrcode.png`, buffer)

  const message2 = await e.reply([
    segment.image('base64://' + base64Data),
    '请在120秒内通过抖音APP扫码进行登录'
  ], true, { recallMsg: 10 })
  msg_id.push(message2.message_id, message1.message_id)

  try {
    // 监听页面的 response 事件，捕捉包含 Set-Cookie 的 302 重定向响应
    page.on('response', async (response) => {
      if (response.status() === 302 && response.url().includes('/passport/sso/login/callback')) {
        // 获取本地的 cookie
        const localCookies = await page.cookies()
        const cookieString = localCookies.map(cookie => {
          return `${cookie.name}=${cookie.value}`
        }).join('; ')
        Config.modify('cookies', 'douyin', cookieString)
        await e.reply('登录成功！用户登录凭证已保存至cookies.yaml', true)
        // 关闭浏览器
        await browser.close()
      }
    })
  } catch (err) {
    await browser.close()
    await e.reply('登录超时！二维码已失效！', true)
    logger.error(err)
  }
  return true
}