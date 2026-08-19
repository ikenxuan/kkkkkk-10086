import { isAbsolute, relative, sep } from 'node:path'

import { importHost } from './import-host.js'
import { convertScreenshotToPng, withPngScreenshot } from './screenshot-options.js'

const STATIC_HTML_FILE_KEY = '__kkkStaticHtmlFile'

export interface ScreenshotResult {
  [key: string]: unknown
}

export interface HostPuppeteer {
  screenshot(name: string, data: Record<string, unknown>): Promise<ScreenshotResult | false>
  screenshots(name: string, data: Record<string, unknown>): Promise<ScreenshotResult[] | false>
  screenshotFile(
    name: string,
    htmlPath: string,
    data: Record<string, unknown>
  ): Promise<ScreenshotResult | false>
  screenshotsFile(
    name: string,
    htmlPath: string,
    data: Record<string, unknown>
  ): Promise<ScreenshotResult[] | false>
}

interface HostPuppeteerModule {
  default: HostPuppeteerBase
}

interface HostPuppeteerBase {
  screenshot(name: string, data: Record<string, unknown>): Promise<ScreenshotResult | false>
  screenshots(name: string, data: Record<string, unknown>): Promise<ScreenshotResult[] | false>
}

type DealTemplate = (name: string, data: Record<string, unknown>) => string | false

interface YunzaiPuppeteer extends HostPuppeteerBase {
  dealTpl?: DealTemplate
}

const { default: hostPuppeteer } = await importHost<HostPuppeteerModule>('lib', 'puppeteer', 'puppeteer.js')
const yunzaiPuppeteer = hostPuppeteer as YunzaiPuppeteer

/**
 * Yunzai's legacy renderer preprocesses every `tplFile` with art-template.
 * Intercept only KKK's explicitly marked standalone documents and return their
 * renderer-relative path unchanged; ordinary Yunzai templates keep the native
 * `dealTpl` implementation.
 */
const originalDealTemplate = yunzaiPuppeteer.dealTpl
if (originalDealTemplate) {
  yunzaiPuppeteer.dealTpl = (name, data) => {
    const staticHtmlPath = data[STATIC_HTML_FILE_KEY]
    if (typeof staticHtmlPath === 'string') {
      const relativePath = relative(process.cwd(), staticHtmlPath)
      const escapesRoot = relativePath === '..' ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)
      if (relativePath && !escapesRoot) {
        return `./${relativePath.split(sep).join('/')}`
      }
      return false
    }
    return originalDealTemplate.call(yunzaiPuppeteer, name, data)
  }
}

const withStaticHtml = (
  htmlPath: string,
  data: Record<string, unknown>
): Record<string, unknown> => ({
  ...withPngScreenshot(data),
  tplFile: htmlPath,
  [STATIC_HTML_FILE_KEY]: htmlPath
})

const puppeteer: HostPuppeteer = {
  screenshot: async (name, data) => {
    const image = await hostPuppeteer.screenshot(name, withPngScreenshot(data))
    return image ? await convertScreenshotToPng(image) : image
  },
  screenshots: async (name, data) => {
    const images = await hostPuppeteer.screenshots(name, withPngScreenshot(data))
    return images ? await Promise.all(images.map(convertScreenshotToPng)) : images
  },
  screenshotFile: async (name, htmlPath, data) => {
    const image = await hostPuppeteer.screenshot(name, withStaticHtml(htmlPath, data))
    return image ? await convertScreenshotToPng(image) : image
  },
  screenshotsFile: async (name, htmlPath, data) => {
    const images = await hostPuppeteer.screenshots(name, withStaticHtml(htmlPath, data))
    return images ? await Promise.all(images.map(convertScreenshotToPng)) : images
  }
}

export default puppeteer
