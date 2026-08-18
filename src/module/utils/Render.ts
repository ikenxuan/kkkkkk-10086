import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import puppeteer from '../../runtime/host/puppeteer.js'
import { Config, Common } from './index.js'
import { renderReactTemplate, resolveReactTemplateRoute } from './react-template/index.js'
import Version from './Version.js'
import {
  applyWatermarkToImages,
  buildWatermarkText,
  type ImageMessage
} from './Watermark.js'

interface GitStatus {
  currentCommitId: string | null
  remoteCommitId: string | null
  latest: boolean
  error: string | null
  commitLog: string | null
}

export interface RenderParams extends Record<string, unknown> {
  scale?: number
}

const getRenderScale = (pct = 1): number => {
  const renderScale = Math.min(2, Math.max(0.5, Number(Config.app.renderScale) / 100))
  return pct * renderScale
}

const scale = (pct = 1): string => `style=transform:scale(${getRenderScale(pct)})`

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
  data: Record<string, unknown>
): Promise<ImageMessage[] | false> => {
  if (Config.app.multiPageRender !== false) return await puppeteer.screenshots(name, data)
  const image = await puppeteer.screenshot(name, data)
  return image ? [image] : false
}

const toPortablePath = (path: string): string => path.replace(/\\/g, '/')

const gitstatus = async (): Promise<string> => {
  const status = await checkCommitIdAndUpdateStatus()

  if (status.error || !status.remoteCommitId) {
    return `& <span class="name">Id</span><span class="version">${status.currentCommitId || 'unknown'}</span>`
  }

  if (status.latest) {
    return `& <span class="name">Id</span><span class="version">${status.currentCommitId}</span>`
  }
  return `& <span class="name">Id</span><span class="commit_id_old">${status.currentCommitId}</span> & <span class="name">新版本</span><span class="tip">${status.remoteCommitId}</span>`
}

const checkCommitIdAndUpdateStatus = async (): Promise<GitStatus> => {
  const git = simpleGit({ baseDir: Version.pluginPath })
  const result: GitStatus = {
    currentCommitId: null,
    remoteCommitId: null,
    latest: false,
    error: null,
    commitLog: null
  }

  const timeoutPromise = new Promise<never>((_resolve, reject) =>
    setTimeout(() => reject(new Error('操作超时')), 5000)
  )

  const mainLogic = (async (): Promise<GitStatus> => {
    try {
      const stdout = execSync(`git -C "${Version.pluginPath}" rev-parse --short=7 HEAD`).toString().trim()
      result.currentCommitId = stdout

      await git.fetch()

      const remoteCommitId = (await git.revparse(['HEAD@{u}'])).substring(0, 7)
      result.remoteCommitId = remoteCommitId

      if (result.currentCommitId === result.remoteCommitId) {
        result.latest = true
        const log = await git.log({ from: result.currentCommitId || '', to: result.currentCommitId || '' })
        if (log?.all?.[0]) result.commitLog = log.all[0].message
      }
    } catch (error: unknown) {
      logger.error(`检查更新状态失败: ${error instanceof Error ? error.message : String(error)}`)
      result.error = '检查更新状态失败'
    }

    return result
  })()

  try {
    return await Promise.race([mainLogic, timeoutPromise])
  } catch (error: unknown) {
    logger.error(error instanceof Error ? error.message : String(error))
    result.error = error instanceof Error ? error.message : String(error)
    return result
  }
}

export const Render = async (
  templatePath: string,
  params: RenderParams = {}
): Promise<ImageMessage[] | false> => {
  const originalTemplatePath = templatePath
  const useDarkTheme = Common.useDarkTheme()
  const reactRoute = resolveReactTemplateRoute(originalTemplatePath)

  if (reactRoute) {
    let rendered: Awaited<ReturnType<typeof renderReactTemplate>> | undefined
    try {
      rendered = await renderReactTemplate(
        originalTemplatePath,
        params,
        {
          scale: getRenderScale(params.scale ?? 1),
          theme: { mode: useDarkTheme ? 'dark' : 'light' },
          ambientCover: Config.app.ambientCover,
          version: {
            plugin: 'yunzai-plugin',
            pluginName: Version.pluginName,
            pluginVersion: Version.version,
            releaseType: Version.version.includes('-') ? 'Preview' : 'Stable',
            poweredBy: Version.BotName,
            frameworkVersion: Version.BotVersion,
            hasUpdate: false
          }
        }
      )
    } catch (error: unknown) {
      logger.warn(`[Render] React 模板 ${reactRoute} 渲染失败，回退旧模板：${error instanceof Error ? error.message : String(error)}`)
    }

    if (rendered) {
      const saveStem = reactRoute.split('/').pop()?.replace(/[^a-zA-Z0-9_-]/g, '-') || 'template'
      const reactData: Record<string, unknown> = {
        tplFile: toPortablePath(join(Version.pluginPath, 'resources', 'react-template', 'bridge.html')),
        ssrHtml: rendered.html,
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
      const images = await captureImages(`${Version.pluginName}/react/${reactRoute}`, reactData)
      if (images === false) return false
      if (Config.app.RemoveWatermark) return images
      return await applyWatermarkToImages(images, buildWatermarkText())
    }
  }

  const basePaths = {
    douyin: 'douyin/html',
    bilibili: 'bilibili/html',
    admin: 'admin/html',
    kuaishou: 'kuaishou/html',
    xiaohongshu: 'xiaohongshu/html',
    other: 'other/html',
    version: 'version/html',
    statistics: 'statistics/html',
    apiError: 'apiError/html'
  }
  const platform = Object.keys(basePaths).find(key => templatePath.startsWith(key)) as keyof typeof basePaths | undefined
  if (platform) {
    let newPath = templatePath.substring(platform.length)
    if (newPath.startsWith('/')) newPath = newPath.substring(1)
    templatePath = `${basePaths[platform]}/${newPath}`
  }
  const data: Record<string, unknown> = {
    _res_path: join(Version.pluginPath, 'resources').replace(/\\/g, '/') + '/',
    _layout_path: join(Version.pluginPath, 'resources', 'template', 'extend').replace(/\\/g, '/') + '/',
    defaultLayout: join(Version.pluginPath, 'resources', 'template', 'extend', 'html', 'default.html').replace(/\\/g, '/'),
    sys: {
      scale: scale(params.scale ?? 1)
    },
    copyright: Config.app.RemoveWatermark ? '' : `<span class="name">${Version.BotName}</span><span class="version">${Version.BotVersion}</span> & <span class="name">${Version.pluginName}</span><span class="version">${Version.version}</span> ${await gitstatus()}`,
    pageGotoParams: {
      waitUntil: 'load',
      timeout: getRenderTimeout()
    },
    useDarkTheme,
    tplFile: `${Version.pluginPath}/resources/template/${templatePath}.html`,
    pluResPath: `${Version.pluginPath}/resources/`,
    saveId: templatePath.split('/').pop(),
    imgType: 'jpeg',
    multiPage: Config.app.multiPageRender !== false,
    multiPageHeight: getMultiPageHeight(),
    ...params
  }
  const images = await captureImages(`${Version.pluginName}/${templatePath}`, data)
  if (images === false) return false
  if (Config.app.RemoveWatermark) return images
  return await applyWatermarkToImages(images, buildWatermarkText())
}
