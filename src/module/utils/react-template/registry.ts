import { existsSync, statSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { RenderContext } from '@/template-sdk/index'
import { PluginPath } from '@/dir'
import { resolveReactTemplateRoute, type ReactTemplateRoute } from './routes.js'

interface StandaloneRenderResult {
  success: boolean
  htmlPath: string
  error?: string
}

interface StandaloneRenderer {
  (templatePath: string, data: unknown, context?: RenderContext): Promise<StandaloneRenderResult>
}

interface StandaloneModule {
  createTemplateRenderer: (options?: {
    outputDir?: string
    htmlFileName?: 'fixed' | 'timestamp' | ((templatePath: string) => string)
    captureDir?: string
  }) => StandaloneRenderer
}

const standaloneEntry = join(PluginPath, 'lib', 'react-template', 'index.mjs')

/**
 * 开发面板（`pnpm template:dev`）的数据来源：置 `KKK_TEMPLATE_CAPTURE=1` 后，
 * 每次真实渲染都会把这一次的 props 快照写成 `ktr/template/<路由>/data/captured.json`，
 * 面板左侧选中它就能拿线上真实数据回放，不用手写 mock。
 *
 * 必须显式传 captureDir，不能依赖 ktr 自己的默认值：它是
 * `process.env.NODE_ENV === 'development' ? resolve('ktr/template') : undefined`，
 * 按 `process.cwd()` 解析 —— 而 Yunzai 启动时 cwd 是宿主根 `E:/Yunzai`
 * （见 `src/dir.ts` 的 `ClientPath = process.cwd()`），
 * 那样会把快照写到 `E:/Yunzai/ktr/template/` 这个不存在的目录去。
 * 这里改成 PluginPath 相对，无论从哪个 cwd 启动都落在本插件的模板树里。
 *
 * 默认关闭：捕获会在每次渲染时多写一次磁盘，且快照里含群号/用户昵称等真实数据。
 * `ktr/.gitignore` 的 `template/**\/*.json` 已经挡住这些文件，不会被提交。
 */
const captureDir = process.env.KKK_TEMPLATE_CAPTURE === '1'
  ? join(PluginPath, 'ktr', 'template')
  : undefined
const renderOutputRoot = join(process.cwd(), 'temp', 'html')
let standaloneModulePromise: Promise<StandaloneModule> | undefined

const loadStandaloneModule = async (): Promise<StandaloneModule> => {
  if (!existsSync(standaloneEntry)) {
    throw new Error(`React standalone 模板构建不存在：${standaloneEntry}，请先执行 pnpm build`)
  }

  const version = statSync(standaloneEntry).mtimeMs
  const module = await import(`${pathToFileURL(standaloneEntry).href}?v=${version}`) as Partial<StandaloneModule>
  if (typeof module.createTemplateRenderer !== 'function') {
    throw new Error(`React standalone 模板入口缺少 createTemplateRenderer 导出：${standaloneEntry}`)
  }
  return module as StandaloneModule
}

const getStandaloneModule = (): Promise<StandaloneModule> => {
  if (!standaloneModulePromise) {
    standaloneModulePromise = loadStandaloneModule().catch(error => {
      standaloneModulePromise = undefined
      throw error
    })
  }
  return standaloneModulePromise
}

const createRenderOutputDir = async (): Promise<string> => {
  await mkdir(renderOutputRoot, { recursive: true })
  return await mkdtemp(join(renderOutputRoot, 'kkkkkk-10086-ktr-'))
}

export interface RenderReactTemplateResult {
  route: ReactTemplateRoute
  htmlPath: string
  cleanup: () => Promise<void>
}

export const renderReactTemplate = async (
  path: string,
  data: unknown,
  context: RenderContext
): Promise<RenderReactTemplateResult> => {
  const route = resolveReactTemplateRoute(path)
  if (!route) throw new Error(`未注册 React 模板路由：${path}`)

  const outputDir = await createRenderOutputDir()
  let cleaned = false
  const cleanup = async (): Promise<void> => {
    if (cleaned) return
    cleaned = true
    await rm(outputDir, { recursive: true, force: true })
  }

  try {
    const module = await getStandaloneModule()
    const renderTemplate = module.createTemplateRenderer({
      outputDir,
      htmlFileName: 'fixed',
      captureDir
    })
    const result = await renderTemplate(route, data, context)
    if (!result.success || !result.htmlPath) {
      throw new Error(result.error || `React standalone 模板渲染失败：${route}`)
    }
    return { route, htmlPath: result.htmlPath, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}
