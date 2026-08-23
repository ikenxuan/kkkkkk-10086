import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement, type ComponentProps, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AmbientCover } from '../../ktr/template/components/AmbientCover'
import { DefaultLayout } from '../../ktr/template/components/DefaultLayout'
import type { PosterContext } from '../../ktr/template/types/ctx'
import * as theme from '../../ktr/utils/theme'

const root = resolve(import.meta.dirname, '..', '..')
const readTemplate = (...parts: string[]) => readFileSync(resolve(root, 'ktr', 'template', ...parts), 'utf8')

const ambientConsumers: Array<[name: string, path: string[], ambientUse: string, parentUse?: string]> = [
  [
    'Douyin image work',
    ['douyin', 'image-work', 'components', 'ImageWork.tsx'],
    '<AmbientCover src={coverUrl} ctx={ctx} />'
  ],
  [
    'Douyin video work',
    ['douyin', 'video-work', 'components', 'VideoWork.tsx'],
    '<AmbientCover src={data.image_url} ctx={ctx} />'
  ],
  [
    'Douyin live',
    ['douyin', 'live', 'components', 'Live.tsx'],
    '<AmbientCover src={pic} ctx={ctx} />',
    '<AmbientBackground pic={d.image_url} ctx={ctx} />'
  ],
  [
    'Bilibili video info',
    ['bilibili', 'videoInfo', 'components', 'videoInfo.tsx'],
    '<AmbientCover src={pic} ctx={ctx} />',
    '<AmbientBackground pic={props.data.pic} ctx={props.ctx} />'
  ],
  [
    'Bilibili live dynamic',
    ['bilibili', 'dynamic', 'DYNAMIC_TYPE_LIVE_RCMD', 'components', 'DYNAMIC_TYPE_LIVE_RCMD.tsx'],
    '<AmbientCover src={cover} ctx={ctx} />',
    '<LiveAmbientBackground cover={data.image_url} ctx={props.ctx} />'
  ]
]

const douyinWorkTemplates: Array<[name: string, path: string[]]> = [
  ['image work', ['douyin', 'image-work', 'components', 'ImageWork.tsx']],
  ['video work', ['douyin', 'video-work', 'components', 'VideoWork.tsx']],
  ['article work', ['douyin', 'article-work', 'components', 'ArticleWork.tsx']]
]

type ThemeModule = {
  isDark?: (ctx: PosterContext) => boolean
}

type DefaultLayoutHasDataProp = 'data' extends keyof ComponentProps<typeof DefaultLayout> ? true : false

const themeModule = theme as ThemeModule
const defaultLayoutHasDataProp: DefaultLayoutHasDataProp = false
const LayoutWithoutBusinessData = DefaultLayout as ComponentType<
  Omit<ComponentProps<typeof DefaultLayout>, 'data'>
>

describe('React template semantic color contract', () => {
  it('uses the current template-react style base and HeroUI semantic variables', () => {
    const style = readTemplate('style.css')

    expect(style).toContain("@import '@karinjs/template-react/styles';")
    expect(style).not.toContain("@import './yunzai-base.css';")
    expect(style).toContain('color: var(--foreground);')
    expect(style).toContain('background-color: var(--background);')
    expect(style).not.toContain('var(--theme-text)')
    expect(style).not.toContain('var(--theme-bg)')
    expect(style).not.toMatch(/@theme\s*\{[^}]*--color-/s)
  })

  it('uses theme-aware surface and warning colors for Douyin video badges', () => {
    const source = readTemplate('douyin', 'user_profile', 'components', 'UserVideoList.tsx')

    expect(source).toContain('bg-surface/80 text-foreground')
    expect(source).toContain('bg-warning text-warning-foreground')
    expect(source).not.toContain('bg-white/50 text-black')
    expect(source).not.toContain('bg-warning text-black')
  })

  it.each([
    ['douyin', 'qrcodeImg'],
    ['bilibili', 'qrcodeImg']
  ])('uses semantic loading-ring borders for %s/%s', (platform, template) => {
    const source = readTemplate(platform, template, 'components', 'qrcodeImg.tsx')

    expect(source).toContain('border-border')
    expect(source).not.toContain('border-gray-200')
    expect(source).not.toContain('border-t-black')
  })
})

describe('React template theme ownership contract', () => {
  it('derives conditional dark-mode behavior exclusively from ctx.theme.mode', () => {
    expect(themeModule.isDark).toBeTypeOf('function')

    const isDark = themeModule.isDark!
    expect(isDark({ scale: 1, theme: { mode: 'dark' } } as PosterContext)).toBe(true)
    expect(isDark({ scale: 1, theme: { mode: 'light' } } as PosterContext)).toBe(false)
    expect(isDark({ scale: 1 } as PosterContext)).toBe(false)
  })

  it('keeps business data and dark/light shell markers out of DefaultLayout', () => {
    const html = renderToStaticMarkup(
      createElement(LayoutWithoutBusinessData, {
        ctx: { scale: 1, theme: { mode: 'dark' } } as PosterContext,
        children: createElement('main', null, 'theme-owned-by-context')
      })
    )
    const openingTag = html.match(/^<div[^>]*>/)?.[0]

    expect(defaultLayoutHasDataProp).toBe(false)
    expect(openingTag).toBeDefined()
    expect(openingTag).not.toContain('data-theme=')
    expect(openingTag).not.toMatch(/class="[^"]*\b(?:dark|light)\b/)
    expect(html).toContain('theme-owned-by-context')
  })
})

describe('React template ambient cover contract', () => {
  it('renders the upstream defaults and honors per-render context overrides', () => {
    const defaults = renderToStaticMarkup(createElement(AmbientCover, { src: '/cover.png' }))
    expect(defaults).toContain('style="opacity:0.7"')
    expect(defaults).toContain('var(--background) 90%')
    expect(defaults).toContain('var(--background) 20%')

    const ctx = {
      scale: 1,
      ambientCover: {
        coverOpacity: 0.35,
        overlayEdgeOpacity: 0.8,
        overlayMiddleOpacity: 0.1
      }
    } as PosterContext
    const themed = renderToStaticMarkup(createElement(AmbientCover, { src: '/cover.png', ctx }))

    expect(themed).toContain('style="opacity:0.35"')
    expect(themed).toContain('var(--background) 80%')
    expect(themed).toContain('var(--background) 10%')
  })

  it.each(ambientConsumers)('forwards ambient-cover context through %s', (_name, path, ambientUse, parentUse) => {
    const source = readTemplate(...path)

    expect(source).toContain(ambientUse)
    if (parentUse) expect(source).toContain(parentUse)
  })
})

describe('Douyin work avatar sizing contract', () => {
  it.each(douyinWorkTemplates)('keeps %s primary avatars at h-24 w-24', (_name, path) => {
    const source = readTemplate(...path)

    expect(source).toContain('h-24 w-24 shrink-0 rounded-full object-cover shadow-2xl')
    expect(source).toContain('h-24 w-24 shrink-0 rounded-full object-cover shadow-xl')
    expect(source).not.toContain('h-26 w-26 shrink-0 rounded-full object-cover')
  })
})
