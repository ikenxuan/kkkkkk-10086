import { readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  REACT_TEMPLATE_ROUTES,
  resolveReactTemplateRoute
} from '../../src/module/utils/react-template/routes.js'

const expectedRoutes = [
  'bilibili/bangumi',
  'bilibili/comment',
  'bilibili/dynamic/DYNAMIC_TYPE_ARTICLE',
  'bilibili/dynamic/DYNAMIC_TYPE_AV',
  'bilibili/dynamic/DYNAMIC_TYPE_DRAW',
  'bilibili/dynamic/DYNAMIC_TYPE_FORWARD',
  'bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
  'bilibili/dynamic/DYNAMIC_TYPE_WORD',
  'bilibili/qrcodeImg',
  'bilibili/userlist',
  'bilibili/videoInfo',
  'douyin/article-work',
  'douyin/comment',
  'douyin/dynamic',
  'douyin/favorite-list',
  'douyin/image-work',
  'douyin/live',
  'douyin/musicinfo',
  'douyin/qrcodeImg',
  'douyin/recommend-list',
  'douyin/user_profile',
  'douyin/userlist',
  'douyin/video-work',
  'kuaishou/comment',
  'other/changelog',
  'other/handlerError',
  'other/help',
  'other/live-photo-tip',
  'other/qrlogin',
  'other/runtime',
  'other/version_warning',
  'statistics/global',
  'statistics/group',
  'xiaohongshu/comment',
  'xiaohongshu/noteInfo'
] as const

const templateRoot = resolve(import.meta.dirname, '..', '..', 'ktr', 'template')

const discoverTemplateRoutes = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => {
    if (
      entry.name.startsWith('.') ||
      entry.name.startsWith('_') ||
      (entry.isDirectory() && entry.name === 'components')
    ) return []
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return discoverTemplateRoutes(path)
    if (entry.isFile() && entry.name === 'index.tsx') {
      return [relative(templateRoot, dirname(path)).replace(/\\/g, '/')]
    }
    return []
  })
  .sort((left, right) => left.localeCompare(right, 'en'))

describe('React template route registry', () => {
  it('freezes the complete upstream route set in deterministic order', () => {
    expect(REACT_TEMPLATE_ROUTES).toEqual(expectedRoutes)
    expect(REACT_TEMPLATE_ROUTES).toHaveLength(35)
    expect([...REACT_TEMPLATE_ROUTES].sort((left, right) => left.localeCompare(right, 'en')))
      .toEqual(REACT_TEMPLATE_ROUTES)
  })

  it('keeps the runtime route allowlist aligned with template entry discovery', () => {
    expect(REACT_TEMPLATE_ROUTES).toEqual(discoverTemplateRoutes(templateRoot))
  })

  it('no longer keeps any legacy route alias', () => {
    // 别名会让 Render() 的报错里出现调用方源码中根本不存在的路由名（报的是解析后的名字），
    // 之前 douyin.ts 传 'douyin/videoInfo' 而日志显示 'douyin/video-work'，排查时非常误导人。
    expect(resolveReactTemplateRoute('douyin/videoInfo')).toBeUndefined()
    // 别名去掉后每个路由都必须只认自己的真名
    for (const route of REACT_TEMPLATE_ROUTES) {
      expect(resolveReactTemplateRoute(route)).toBe(route)
    }
  })

  it('normalizes harmless path syntax without accepting traversal', () => {
    expect(resolveReactTemplateRoute('/other/help/')).toBe('other/help')
    expect(resolveReactTemplateRoute('other\\help')).toBe('other/help')
    expect(resolveReactTemplateRoute('../other/help')).toBeUndefined()
    expect(resolveReactTemplateRoute('other/../../help')).toBeUndefined()
  })

  it('leaves templates without an upstream React route on the legacy renderer', () => {
    expect(resolveReactTemplateRoute('admin/index')).toBeUndefined()
    expect(resolveReactTemplateRoute('apiError/index')).toBeUndefined()
    expect(resolveReactTemplateRoute('not-a-platform/card')).toBeUndefined()
  })
})
