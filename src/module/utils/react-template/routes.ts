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

/**
 * 调用方旧路由名到当前模板路由的映射。
 *
 * 目前为空：唯一的历史别名 `douyin/videoInfo` 已随 `renderWorkImage` 落地被去掉。
 * 保留这张表是因为别名会让 `Render()` 的报错里出现调用方源码中不存在的路由名
 * （报的是解析后的名字），排查时非常误导人，所以新增别名前先确认真的无法改调用点。
 */
const aliases: Record<string, ReactTemplateRoute> = {}

const routeSet = new Set<string>(REACT_TEMPLATE_ROUTES)

/** Resolve a caller path without allowing filesystem traversal. */
export const resolveReactTemplateRoute = (value: string): ReactTemplateRoute | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized.split('/').some(segment => segment === '..' || segment === '.')) return undefined
  const route = aliases[normalized] ?? normalized
  return routeSet.has(route) ? route as ReactTemplateRoute : undefined
}
