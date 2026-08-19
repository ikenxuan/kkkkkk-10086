import { randomUUID } from 'node:crypto'
import puppeteer from '../../runtime/host/puppeteer.js'
import { Config, Common } from './index.js'
import {
  renderReactTemplate,
  resolveReactTemplateRoute
} from './react-template/index.js'
import Version from './Version.js'
import {
  applyWatermarkToImages,
  buildWatermarkText,
  type ImageMessage
} from './Watermark.js'

export interface RenderParams extends Record<string, unknown> {
  scale?: number
}

const getRenderScale = (pct = 1): number => {
  const renderScale = Math.min(2, Math.max(0.5, Number(Config.app.renderScale) / 100))
  return pct * renderScale
}

const getRenderTimeout = (): number => {
  const seconds = Number(Config.app.RenderWaitTime)
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000
}

const getMultiPageHeight = (): number => {
  const height = Number(Config.app.multiPageHeight)
  return Number.isFinite(height) && height > 0 ? height : 12000
}

const captureImages = async (
  name: string,
  htmlPath: string,
  data: Record<string, unknown>
): Promise<ImageMessage[] | false> => {
  if (Config.app.multiPageRender !== false) {
    return await puppeteer.screenshotsFile(name, htmlPath, data)
  }
  const image = await puppeteer.screenshotFile(name, htmlPath, data)
  return image ? [image] : false
}

export const Render = async (
  templatePath: string,
  params: RenderParams = {}
): Promise<ImageMessage[] | false> => {
  const useDarkTheme = Common.useDarkTheme()
  const reactRoute = resolveReactTemplateRoute(templatePath)
  if (!reactRoute) {
    throw new Error(`[Render] 未注册 React 模板路由：${templatePath}`)
  }
  let version: Record<string, unknown> | undefined
  if (!Config.app.RemoveWatermark) {
    version = {
      plugin: 'yunzai-plugin',
      pluginName: Version.pluginName,
      pluginVersion: Version.version,
      releaseType: Version.version.includes('-') ? 'Preview' : 'Stable',
      poweredBy: Version.BotName,
      frameworkVersion: Version.BotVersion,
      hasUpdate: false
    }
  }

  let rendered: Awaited<ReturnType<typeof renderReactTemplate>>
  try {
    rendered = await renderReactTemplate(
      reactRoute,
      params,
      {
        scale: getRenderScale(params.scale ?? 1),
        theme: { mode: useDarkTheme ? 'dark' : 'light' },
        ambientCover: Config.app.ambientCover,
        version
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`[Render] React SSR 渲染失败（${reactRoute}）：${message}`, { cause: error })
  }

  const saveStem = reactRoute.split('/').pop()?.replace(/[^a-zA-Z0-9_-]/g, '-') || 'template'
  const screenshotData: Record<string, unknown> = {
    saveId: `${saveStem}-${randomUUID()}`,
    imgType: 'png',
    omitBackground: true,
    multiPage: Config.app.multiPageRender !== false,
    multiPageHeight: getMultiPageHeight(),
    pageGotoParams: {
      waitUntil: 'load',
      timeout: getRenderTimeout()
    }
  }

  let images: ImageMessage[] | false
  try {
    images = await captureImages(
      `${Version.pluginName}/react/${reactRoute}`,
      rendered.htmlPath,
      screenshotData
    )
  } finally {
    await rendered.cleanup()
  }
  if (images === false) return false
  if (Config.app.RemoveWatermark) return images
  return await applyWatermarkToImages(images, buildWatermarkText())
}
