/**
 * Routes shipped by karin-plugin-kkk's feat-template-react branch.
 * Keep this list explicit and sorted: it is part of the compatibility
 * boundary between old Yunzai call sites and the new React poster bundle.
 */
export const REACT_TEMPLATE_ROUTES = [
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

export type ReactTemplateRoute = (typeof REACT_TEMPLATE_ROUTES)[number]

const aliases: Record<string, ReactTemplateRoute> = {
  // Current Yunzai callers still use the old, generic videoInfo name.
  'douyin/videoInfo': 'douyin/video-work'
}

const routeSet = new Set<string>(REACT_TEMPLATE_ROUTES)

/** Resolve a caller path without allowing filesystem traversal. */
export const resolveReactTemplateRoute = (value: string): ReactTemplateRoute | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized.split('/').some(segment => segment === '..' || segment === '.')) return undefined
  const route = aliases[normalized] ?? normalized
  return routeSet.has(route) ? route as ReactTemplateRoute : undefined
}
