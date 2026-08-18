import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import type { LoadedRegistry, RenderContext, TemplateDefinition } from '../../../template-sdk/index.js'
import { ResourcePath } from '../../../dir.js'
import { renderTemplateDocument, type RenderTemplateDocumentResult } from './html.js'
import { resolveReactTemplateRoute, type ReactTemplateRoute } from './routes.js'

type BuiltRegistry = {
  templates: Record<string, TemplateDefinition>
}

let registryPromise: Promise<LoadedRegistry> | undefined

const runtimeRoot = dirname(fileURLToPath(import.meta.url))

const loadBuiltRegistry = async (): Promise<LoadedRegistry> => {
  const registryPath = join(runtimeRoot, '../../../template-registry.js')
  if (!existsSync(registryPath)) {
    throw new Error(`React 模板注册表不存在：${registryPath}，请先执行 pnpm build`)
  }
  const module = await import(`${pathToFileURL(registryPath).href}?v=${readFileSync(registryPath).byteLength}`) as BuiltRegistry
  if (!module.templates || typeof module.templates !== 'object') {
    throw new Error('React 模板注册表缺少 templates 导出')
  }
  return module.templates as LoadedRegistry
}

export const loadReactTemplateRegistry = (): Promise<LoadedRegistry> => {
  registryPromise ??= loadBuiltRegistry()
  return registryPromise
}

interface LoadedCss {
  content: string
  assetsDir: string
}

let stylesheetCache: LoadedCss | undefined

const loadCss = (): LoadedCss => {
  if (stylesheetCache) return stylesheetCache
  const candidates = [
    {
      file: join(runtimeRoot, '../../../template-style.css'),
      assetsDir: join(runtimeRoot, '../../..')
    },
    {
      file: join(ResourcePath, 'react-template', 'style.css'),
      assetsDir: ResourcePath
    }
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate.file)) {
      stylesheetCache = {
        content: readFileSync(candidate.file, 'utf8'),
        assetsDir: candidate.assetsDir
      }
      return stylesheetCache
    }
  }
  throw new Error(`React 模板样式不存在：${candidates.map(candidate => candidate.file).join(', ')}`)
}

export interface RenderReactTemplateResult extends RenderTemplateDocumentResult {
  route: ReactTemplateRoute
}

export const renderReactTemplate = async (
  path: string,
  data: unknown,
  context: RenderContext
): Promise<RenderReactTemplateResult> => {
  const route = resolveReactTemplateRoute(path)
  if (!route) throw new Error(`未注册 React 模板路由：${path}`)
  const registry = await loadReactTemplateRegistry()
  const definition = registry[route]
  if (!definition) throw new Error(`React 模板注册表缺少路由：${route}`)
  if (definition.validate && !definition.validate(data)) throw new Error(`React 模板数据校验失败：${route}`)
  const stylesheet = loadCss()
  const result = await renderTemplateDocument({
    route,
    component: definition.component,
    data,
    context,
    css: stylesheet.content,
    assetsDir: ResourcePath,
    cssAssetsDir: stylesheet.assetsDir
  })
  return { ...result, route }
}
