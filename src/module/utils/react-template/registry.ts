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
  }) => StandaloneRenderer
}

const standaloneEntry = join(PluginPath, 'lib', 'react-template', 'index.mjs')
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
      htmlFileName: 'fixed'
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
