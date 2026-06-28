import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { scan } from '@ikenxuan/qrcode'
import { newInjectedPage } from 'fingerprint-injector'
import { Common, Config, Render, Version } from '../../utils/index.js'

const LOGIN_URL = 'https://www.douyin.com'
const QR_SELECTOR = 'img[aria-label="二维码"], .web-login-scan-code__content__qrcode-wrapper img'

const getOperatingSystem = () => {
  const platform = os.platform()
  if (platform === 'win32') return 'windows'
  if (platform === 'darwin') return 'macos'
  return 'linux'
}

const getChromeExecutablePath = () => {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean)
  return candidates.find(item => fs.existsSync(item))
}

const getMessageId = msg => msg?.message_id || msg?.messageId

const recallMessages = async (e, ids) => {
  await Promise.all(ids.filter(Boolean).map(async id => {
    try {
      await e.bot?.recallMsg?.(e, id)
    } catch {}
  }))
}

const safeScreenshot = async (page, filename) => {
  try {
    await Common.mkdir(Common.tempDri.default)
    await page.screenshot({ path: join(Common.tempDri.default, filename) })
  } catch (error) {
    logger.warn(`[抖音登录] 截图失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const getImageBuffer = async src => {
  if (!src) return null
  if (src.startsWith('data:image')) return Buffer.from(src.split(',')[1] || '', 'base64')
  const response = await fetch(src)
  return Buffer.from(await response.arrayBuffer())
}

const waitQrcode = async page => {
  await page.waitForSelector(QR_SELECTOR, { timeout: 60000 })
  await new Promise(resolve => setTimeout(resolve, 1000))
  const src = await page.$eval(QR_SELECTOR, img => img.getAttribute('src') || '')
  const imageBuffer = await getImageBuffer(src)
  if (!imageBuffer?.length) throw new Error('二维码图片为空')
  let decoded = ''
  try {
    decoded = scan(imageBuffer) || ''
    if (decoded) logger.mark(`[抖音登录] 二维码解码成功: ${decoded}`)
  } catch (error) {
    logger.warn(`[抖音登录] 二维码解码失败，将发送原图: ${error instanceof Error ? error.message : String(error)}`)
  }
  return {
    src,
    buffer: imageBuffer,
    decoded
  }
}

const createLoginPage = async browser => {
  const page = await newInjectedPage(browser, {
    fingerprintOptions: {
      devices: ['desktop'],
      operatingSystems: [getOperatingSystem()]
    }
  })

  await page.setRequestInterception(true)
  page.on('request', request => {
    const resourceType = request.resourceType()
    const url = request.url()
    const shouldBlock =
      resourceType === 'media' ||
      resourceType === 'font' ||
      /\.(mp4|webm|m3u8|flv|avi|mov|wmv|mkv)(\?|$)/i.test(url) ||
      url.includes('/aweme/') ||
      (resourceType === 'image' && !url.includes('qrcode') && !url.startsWith('data:image') && /\.(jpe?g|webp)(\?|$)/i.test(url))
    if (shouldBlock) request.abort()
    else request.continue()
  })

  await page.evaluateOnNewDocument(() => {
    HTMLMediaElement.prototype.play = function () {
      return Promise.reject(new Error('Video playback blocked'))
    }
    if (window.MediaSource) window.MediaSource = undefined
    window.IntersectionObserver = class {
      observe () {}
      unobserve () {}
      disconnect () {}
    }
  })

  return page
}

const saveDouyinCookies = async page => {
  const cookies = await page.cookies()
  const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
  Config.modify('cookies', 'douyin', cookieString)
  const hasSessionidSs = cookies.some(cookie => cookie.name === 'sessionid_ss')
  const hasTtwid = cookies.some(cookie => cookie.name === 'ttwid')
  logger.mark(`[抖音登录] Cookie 参数检测: sessionid_ss=${hasSessionidSs}, ttwid=${hasTtwid}`)
  if (!hasSessionidSs || !hasTtwid) logger.warn('[抖音登录] 登录 cookie 缺少关键字段，后续 API 可能不可用')
}

const clickTextButton = async (page, text) => {
  return await page.evaluate(buttonText => {
    const elements = Array.from(document.querySelectorAll('*'))
    const element = elements.find(el => el.textContent?.trim() === buttonText)
    if (!element) return false
    element.click()
    return true
  }, text)
}

const handleSecondVerify = async (page, getCode) => {
  if (typeof getCode !== 'function') {
    return { ok: false, message: '当前登录需要短信二次验证，但当前运行环境没有提供验证码输入上下文。请先使用「#设置抖音ck」手动保存 ck。' }
  }

  try {
    await page.waitForSelector('#uc-second-verify', { timeout: 8000 })
    const clicked = await clickTextButton(page, '接收短信验证码')
    if (!clicked) logger.warn('[抖音登录] 未找到「接收短信验证码」按钮，继续等待验证码输入框')

    const inputSelector = '#uc-second-verify input'
    await page.waitForSelector(inputSelector, { timeout: 15000 })

    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt = attempt === 1
        ? '此次验证需要进行短信 2FA。\n6 位验证码已发送至扫码设备绑定的手机号，请在 60 秒内发送验证码。'
        : '验证码错误，请重新发送正确的 6 位验证码（剩余机会：1次）。'
      const code = await getCode(prompt)
      if (!/^\d{6}$/.test(String(code || '').trim())) {
        if (attempt === 2) return { ok: false, message: '验证码格式无效，登录失败' }
        continue
      }

      await page.evaluate(selector => {
        const input = document.querySelector(selector)
        if (input) input.value = ''
      }, inputSelector)
      await page.type(inputSelector, String(code).trim())

      const validatePromise = new Promise(resolve => {
        const handler = async response => {
          if (!response.url().includes('validate_code')) return
          try {
            const body = await response.text()
            const json = JSON.parse(body)
            logger.debug('[抖音登录] 验证码验证响应:', json)
            page.off('response', handler)
            if (json?.data?.error_code === 1202) resolve(false)
            else if (json?.message === 'success' || !json?.data?.error_code) resolve(true)
            else resolve(false)
          } catch (error) {
            logger.warn(`[抖音登录] 解析验证码验证响应失败: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        page.on('response', handler)
        setTimeout(() => {
          page.off('response', handler)
          resolve(false)
        }, 8000)
      })

      await clickTextButton(page, '验证')
      const verified = await validatePromise
      if (verified) {
        logger.mark('[抖音登录] 2FA 验证通过，等待最终登录确认')
        return { ok: true }
      }
    }
    return { ok: false, message: '验证码错误或验证超时，登录失败' }
  } catch (error) {
    logger.error('[抖音登录] 二次验证处理失败', error)
    return { ok: false, message: '二次验证处理失败，登录失败' }
  }
}

export const dylogin = async (e, options = {}) => {
  const messageIds = []
  let browser
  try {
    const disclaimerMsg = await e.reply('免责声明:\n您将通过扫码完成获取抖音网页端的用户登录凭证（ck），该ck将用于请求抖音 WEB API 接口。\n本BOT不会上传任何有关你的信息到第三方，所配置的 ck 只会用于请求官方 API 接口。\n我方仅提供视频解析及相关抖音内容服务，若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码 ~', true)
    messageIds.push(getMessageId(disclaimerMsg))

    const executablePath = getChromeExecutablePath()
    browser = await puppeteer.launch({
      headless: 'new',
      ...(executablePath ? { executablePath } : {}),
      protocolTimeout: 60000,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--mute-audio',
        '--window-size=800,600',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-extensions',
        '--disable-notifications',
        '--disable-translate',
        '--disable-renderer-backgrounding'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    })

    const page = await createLoginPage(browser)
    await page.goto(LOGIN_URL, { timeout: 120000, waitUntil: 'domcontentloaded' })

    let qr
    try {
      qr = await waitQrcode(page)
    } catch (error) {
      await safeScreenshot(page, 'DouyinLoginQrcodeError.png')
      await e.reply(`获取二维码失败：${error instanceof Error ? error.message : String(error)}`, true)
      return true
    }

    await Common.mkdir(Common.tempDri.default)
    fs.writeFileSync(join(Common.tempDri.default, 'DouyinLoginQrcode.png'), qr.buffer)
    const qrcodeMsg = await e.reply(
      await Render('douyin/qrcodeImg', { share_url: qr.decoded || qr.src }),
      true
    )
    messageIds.push(getMessageId(qrcodeMsg))

    const loginResult = await new Promise(resolve => {
      let settled = false
      let loginTimeout
      const finish = result => {
        if (settled) return
        settled = true
        clearTimeout(loginTimeout)
        resolve(result)
      }
      const resetTimeout = (ms, message) => {
        clearTimeout(loginTimeout)
        loginTimeout = setTimeout(() => finish({ ok: false, message }), ms)
      }
      resetTimeout(120000, '登录超时！二维码已失效！')
      let scannedHandled = false
      let secondVerifyHandled = false

      page.on('response', async response => {
        const url = response.url()
        if (!url.includes('check_qrconnect')) return
        try {
          const setCookie = response.headers()['set-cookie'] || ''
          if (setCookie.includes('sid_guard')) {
            await saveDouyinCookies(page)
            finish({ ok: true, message: '登录成功！用户登录凭证已保存至 cookies.yaml' })
            return
          }

          const body = await response.text()
          const json = JSON.parse(body)
          if (json?.data?.status === 'scanned' && !scannedHandled) {
            scannedHandled = true
            const scannedMsg = await e.reply('二维码已扫码，请在手机上授权以登录', true)
            messageIds.push(getMessageId(scannedMsg))
          }
          if (json?.data?.error_code === 2046 && !secondVerifyHandled) {
            secondVerifyHandled = true
            resetTimeout(90000, '二次验证后等待登录确认超时，登录失败')
            const verifyResult = await handleSecondVerify(page, options.waitForCode)
            if (!verifyResult.ok) finish(verifyResult)
          }
        } catch (error) {
          logger.warn(`[抖音登录] 处理登录响应失败: ${error instanceof Error ? error.message : String(error)}`)
        }
      })
    })

    await e.reply(loginResult.message, true)
    await recallMessages(e, messageIds)
  } catch (error) {
    logger.error('[抖音登录] 登录流程出错', error)
    await e.reply('登录过程出错，请查看控制台日志', true)
  } finally {
    if (browser) await browser.close().catch(err => logger.warn(`[抖音登录] 关闭浏览器失败: ${err.message}`))
  }
  return true
}
