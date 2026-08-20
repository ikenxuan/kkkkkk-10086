import { randomUUID } from 'node:crypto'
import puppeteer from '@/runtime/host/puppeteer'
import { getBuildMetadata } from '@/module/tooling/build-metadata'
import { getInstallState, getReleaseChannel } from '@/module/tooling/release-channel'
import { Config, Common } from './index.js'
import {
  renderReactTemplate,
  resolveReactTemplateRoute,
  type ReactTemplateRoute,
  type TemplateParams
} from './react-template/index.js'
import Version from './Version.js'
import {
  applyWatermarkToImages,
  buildWatermarkText,
  type ImageMessage
} from './Watermark.js'

export type { RenderParams } from './react-template/index.js'

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

/**
 * 渲染一张模板图。
 *
 * `templatePath` 收窄成 {@link ReactTemplateRoute}，写错路由名不用等运行时抛错；
 * `params` 按路由查 {@link TemplateParams}，登记过契约的路由少传、多传、类型不对都会红。
 * 契约表只在 `pnpm typecheck:render` 那个 program 里填满，构建时是空表、退回宽松校验，
 * 原因见 `react-template/template-data.ts`。
 */
export const Render = async <R extends ReactTemplateRoute> (
  templatePath: R,
  params: TemplateParams<R> = {} as TemplateParams<R>
): Promise<ImageMessage[] | false> => {
  const useDarkTheme = Common.useDarkTheme()
  const reactRoute = resolveReactTemplateRoute(templatePath)
  if (!reactRoute) {
    throw new Error(`[Render] 未注册 React 模板路由：${templatePath}`)
  }
  let version: Record<string, unknown> | undefined
  if (!Config.app.RemoveWatermark) {
    // 页脚的短提交号取构建时烘进 build-metadata.json 的源码提交：
    // preview / release 分支的 git 历史是产物历史，问本地 git 拿不到源码提交号；
    // 而 lib/ 就是那次构建出来的，这个号描述的正是「现在跑的是哪份代码」。
    // 'unknown' 是 build-metadata 在没有 git 时写下的占位，别让它印成 -gunknown。
    const buildMetadata = getBuildMetadata()
    const commitId = buildMetadata?.shortCommitHash && buildMetadata.shortCommitHash !== 'unknown'
      ? buildMetadata.shortCommitHash
      : undefined
    // 工作区状态来自安装目录自己的 git 仓库；测不出来时两个字段都是 null，
    // 页脚对应那两段就不显示（见 release-channel.ts 里为什么 null 不等于干净）
    const installState = getInstallState()
    version = {
      plugin: 'yunzai-plugin',
      pluginName: Version.pluginName,
      pluginVersion: Version.version,
      commitId,
      commitsAhead: installState.ahead ?? undefined,
      dirty: installState.dirty === true,
      releaseType: getReleaseChannel(),
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
        // 宿主在 multiPage 为真时把编码强制改成 jpeg（我们传的 imgType: 'png' 被覆盖），
        // jpeg 没有 alpha。只有单图路径成图才真是 png，卡片也才敢上圆角。
        alphaOutput: Config.app.multiPageRender === false,
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
