import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { RenderContext } from '@/template-sdk/index'
import { PluginPath } from '@/dir'
import { resolveReactTemplateRoute } from './routes.js'
import type { ReactTemplateRoute } from './types.js'
import { createRenderCacheWorkspace } from '@/module/utils/cache/runtime'
import { warnCacheCleanupFailure } from '@/module/utils/cache/cleanup'

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

/** 调试快照只在受管工作目录保留；development 模式也限制在临时目录，避免 SDK 按 cwd 永久写入模板树。 */
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

  const workspace = await createRenderCacheWorkspace()
  const outputDir = workspace.path
  const cleanup = workspace.cleanup

  try {
    const module = await getStandaloneModule()
    const renderTemplate = module.createTemplateRenderer({
      outputDir,
      htmlFileName: 'fixed',
      captureDir: process.env.KKK_TEMPLATE_CAPTURE === '1' || process.env.NODE_ENV === 'development'
        ? join(outputDir, 'capture')
        : undefined
    })
    const result = await renderTemplate(route, data, context)
    if (!result.success || !result.htmlPath) {
      throw new Error(result.error || `React standalone 模板渲染失败：${route}`)
    }
    return { route, htmlPath: result.htmlPath, cleanup }
  } catch (error) {
    await cleanup().catch(warnCacheCleanupFailure)
    throw error
  }
}
