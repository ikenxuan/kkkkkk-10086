import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ComponentType } from 'react'
import { createElement } from 'react'
import { renderToReadableStream } from 'react-dom/server'

import type { RenderContext, TemplateProps } from '../../../template-sdk/index.js'

export interface RenderTemplateDocumentOptions<Data = unknown> {
  route: string
  component: ComponentType<TemplateProps<Data>>
  data: Data
  context: RenderContext
  css: string
  assetsDir: string
  cssAssetsDir?: string
  assetsInlineLimit?: number
}

export interface RenderTemplateDocumentResult {
  route: string
  html: string
}

/** Resolve a root-relative asset while refusing `..` escapes and remote URLs. */
export const resolveTemplateAsset = (asset: string, assetsDir: string): string | undefined => {
  if (!asset || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(asset)) return undefined
  const normalized = asset.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.split('/').some(part => part === '..' || part === '.')) return undefined
  const root = resolve(assetsDir)
  const candidate = resolve(root, normalized)
  const relativePath = relative(root, candidate)
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) return undefined
  return candidate
}

const mimeTypes: Record<string, string> = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
}

const DEFAULT_ASSETS_INLINE_LIMIT = 4 * 1024
const assetRewriteCache = new Map<string, string>()
const cssRewriteCache = new Map<string, Map<string, string>>()

const toDataUri = (file: string): string => {
  const mime = mimeTypes[extname(file).toLowerCase()] ?? 'application/octet-stream'
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`
}

const toSafeFileUrl = (file: string): string => pathToFileURL(file).href

const rewriteAsset = (asset: string, assetsDir: string, inlineLimit: number): string => {
  const file = resolveTemplateAsset(asset, assetsDir)
  if (!file || !existsSync(file)) return asset
  try {
    const stats = statSync(file)
    const cacheKey = `${file}\0${stats.size}\0${stats.mtimeMs}\0${inlineLimit}`
    const cached = assetRewriteCache.get(cacheKey)
    if (cached) return cached
    const rewritten = stats.size <= inlineLimit ? toDataUri(file) : toSafeFileUrl(file)
    assetRewriteCache.set(cacheKey, rewritten)
    return rewritten
  } catch {
    return asset
  }
}

const rewriteCssAssets = (css: string, assetsDir: string, inlineLimit: number): string => {
  const cacheKey = `${resolve(assetsDir)}\0${inlineLimit}`
  const cached = cssRewriteCache.get(css)?.get(cacheKey)
  if (cached) return cached

  const rewritten = css.replace(/url\(\s*(['"]?)(\/(?!\/)[^'")]+)\1\s*\)/gi, (_match, quote: string, asset: string) => {
    const rewritten = rewriteAsset(asset, assetsDir, inlineLimit)
    return `url(${quote}${rewritten}${quote})`
  })
  const entries = cssRewriteCache.get(css) ?? new Map<string, string>()
  entries.set(cacheKey, rewritten)
  cssRewriteCache.set(css, entries)
  return rewritten
}

const rewriteMarkupAssets = (markup: string, assetsDir: string, inlineLimit: number): string =>
  markup.replace(/\b(src|href)=(['"])(\/(?!\/)[^'"]+)\2/gi, (_match, name: string, quote: string, asset: string) =>
    `${name}=${quote}${rewriteAsset(asset, assetsDir, inlineLimit)}${quote}`)

/**
 * Render a React component to standalone HTML for Yunzai's raw bridge.
 * React performs all user-data escaping; the bridge only inserts this result
 * and deliberately never treats it as another art-template source.
 */
export const renderTemplateDocument = async <Data>(
  options: RenderTemplateDocumentOptions<Data>
): Promise<RenderTemplateDocumentResult> => {
  const inlineLimit = options.assetsInlineLimit ?? DEFAULT_ASSETS_INLINE_LIMIT
  const stream = await renderToReadableStream(createElement(options.component, {
    data: options.data,
    ctx: options.context
  }))
  await stream.allReady
  const markup = await new Response(stream).text()
  const css = rewriteCssAssets(options.css, options.cssAssetsDir ?? options.assetsDir, inlineLimit)
  const wrappedMarkup = rewriteMarkupAssets(markup, options.assetsDir, inlineLimit)
  const mode = options.context.theme?.mode === 'dark' ? 'dark' : 'light'
  const classAttribute = mode === 'dark' ? ' class="dark"' : ''
  const scale = Number.isFinite(options.context.scale) && options.context.scale > 0
    ? options.context.scale
    : 1
  const zoomCss = scale === 1 ? '' : `;zoom:${scale}`
  const resetCss = 'html,body{margin:0;padding:0;background:transparent}body{display:flex;align-items:flex-start;justify-content:flex-start;min-width:fit-content;min-height:fit-content}' +
    `#container{position:relative;flex-shrink:0;isolation:isolate${zoomCss}}`
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"><style>${css}</style><style>${resetCss}</style></head><body${classAttribute} data-theme="${mode}" style="margin:0;padding:0;background:transparent"><div id="container">${wrappedMarkup}</div></body></html>`

  return { route: options.route, html }
}

export const fileUrlForAsset = (file: string): string => pathToFileURL(resolve(file)).href

export const assetBasename = (file: string): string => basename(file)
