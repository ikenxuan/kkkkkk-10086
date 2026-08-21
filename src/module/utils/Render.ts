import { randomUUID } from 'node:crypto'
import puppeteer from '@/runtime/host/puppeteer'
import { getBuildMetadata } from '@/module/tooling/build-metadata'
import { sliceTallImage } from './imageSlicer.js'
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

/**
 * 截一张成图，超高时自己切片。
 *
 * 一律走宿主的单图接口，不用它的 `screenshots`：宿主只要看到 `multiPage` 为真就把编码
 * 强制改成 jpeg（renderers/puppeteer/lib/puppeteer.js:212-215，我们传的 imgType: 'png'
 * 被直接覆盖），jpeg 没有 alpha，卡片圆角外那圈透明像素会被合成成纯白 —— 实测
 * rgba(255,255,255,255)，也就是成图四角的白三角。而它的分片路径还会从截元素改成截视口，
 * 把卡片没盖住的区域一起拍进去。
 *
 * 所以分片改成自己做：拿单张 png，再按 `multiPageHeight` 用 sharp 纵向切，
 * alpha 全程留得住，圆角在首片和末片上照常成立。
 * `multiPageRender: false` 的语义不变 —— 那是「不要分片」，此时整张发出去。
 */
const captureImages = async (
  name: string,
  htmlPath: string,
  data: Record<string, unknown>
): Promise<ImageMessage[] | false> => {
  const image = await puppeteer.screenshotFile(name, htmlPath, data)
  if (!image) return false
  if (Config.app.multiPageRender === false) return [image]
  return await sliceTallImage(image, getMultiPageHeight())
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
    // 一定要是 false：宿主见到它为真就把 imgType 覆盖成 jpeg，alpha 就没了。
    // 分片由 captureImages 自己用 sharp 做，宿主的 multiPageHeight 因此也不再需要。
    multiPage: false,
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
