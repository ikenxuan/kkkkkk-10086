import { importHost } from './import-host.js'

export interface ScreenshotResult {
  type: string
  data: string
}

export interface HostPuppeteer {
  screenshot(name: string, data: Record<string, unknown>): Promise<ScreenshotResult | false>
  screenshots(name: string, data: Record<string, unknown>): Promise<ScreenshotResult[] | false>
}

interface HostPuppeteerModule {
  default: HostPuppeteer
}

const { default: puppeteer } = await importHost<HostPuppeteerModule>('lib', 'puppeteer', 'puppeteer.js')

export default puppeteer
