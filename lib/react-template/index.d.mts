// 此文件由 @karinjs/template-react 自动生成，请不要手动修改。
import type { DataOf, RenderContextInput, RendererOptions, RenderResult } from '@karinjs/template-react'

interface TemplateRegistry {
  'bilibili/bangumi': typeof import('../../ktr/template/bilibili/bangumi/index').default
  'bilibili/comment': typeof import('../../ktr/template/bilibili/comment/index').default
  'bilibili/dynamic/DYNAMIC_TYPE_ARTICLE': typeof import('../../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_ARTICLE/index').default
  'bilibili/dynamic/DYNAMIC_TYPE_AV': typeof import('../../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_AV/index').default
  'bilibili/dynamic/DYNAMIC_TYPE_DRAW': typeof import('../../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_DRAW/index').default
  'bilibili/dynamic/DYNAMIC_TYPE_FORWARD': typeof import('../../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_FORWARD/index').default
  'bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD': typeof import('../../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD/index').default
  'bilibili/dynamic/DYNAMIC_TYPE_WORD': typeof import('../../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_WORD/index').default
  'bilibili/qrcodeImg': typeof import('../../ktr/template/bilibili/qrcodeImg/index').default
  'bilibili/userlist': typeof import('../../ktr/template/bilibili/userlist/index').default
  'bilibili/videoInfo': typeof import('../../ktr/template/bilibili/videoInfo/index').default
  'douyin/article-work': typeof import('../../ktr/template/douyin/article-work/index').default
  'douyin/comment': typeof import('../../ktr/template/douyin/comment/index').default
  'douyin/dynamic': typeof import('../../ktr/template/douyin/dynamic/index').default
  'douyin/favorite-list': typeof import('../../ktr/template/douyin/favorite-list/index').default
  'douyin/image-work': typeof import('../../ktr/template/douyin/image-work/index').default
  'douyin/live': typeof import('../../ktr/template/douyin/live/index').default
  'douyin/musicinfo': typeof import('../../ktr/template/douyin/musicinfo/index').default
  'douyin/qrcodeImg': typeof import('../../ktr/template/douyin/qrcodeImg/index').default
  'douyin/recommend-list': typeof import('../../ktr/template/douyin/recommend-list/index').default
  'douyin/user_profile': typeof import('../../ktr/template/douyin/user_profile/index').default
  'douyin/userlist': typeof import('../../ktr/template/douyin/userlist/index').default
  'douyin/video-work': typeof import('../../ktr/template/douyin/video-work/index').default
  'kuaishou/comment': typeof import('../../ktr/template/kuaishou/comment/index').default
  'other/changelog': typeof import('../../ktr/template/other/changelog/index').default
  'other/handlerError': typeof import('../../ktr/template/other/handlerError/index').default
  'other/help': typeof import('../../ktr/template/other/help/index').default
  'other/live-photo-tip': typeof import('../../ktr/template/other/live-photo-tip/index').default
  'other/qrlogin': typeof import('../../ktr/template/other/qrlogin/index').default
  'other/runtime': typeof import('../../ktr/template/other/runtime/index').default
  'other/version_warning': typeof import('../../ktr/template/other/version_warning/index').default
  'statistics/global': typeof import('../../ktr/template/statistics/global/index').default
  'statistics/group': typeof import('../../ktr/template/statistics/group/index').default
  'xiaohongshu/comment': typeof import('../../ktr/template/xiaohongshu/comment/index').default
  'xiaohongshu/noteInfo': typeof import('../../ktr/template/xiaohongshu/noteInfo/index').default
}

export type TemplatePath = keyof TemplateRegistry & string
export type TemplateDataMap = {
  [K in TemplatePath]: DataOf<TemplateRegistry[K]>
}
export type TemplateData<K extends TemplatePath> = TemplateDataMap[K]
export type StandaloneRendererOptions = Omit<Partial<RendererOptions>, 'cssPath' | 'cssText'>
export type TemplateRenderFn = <K extends TemplatePath>(
  templatePath: K,
  data: TemplateData<K>,
  ctx?: RenderContextInput
) => Promise<RenderResult>

export declare const createTemplateRenderer: (options?: StandaloneRendererOptions) => TemplateRenderFn
export declare const renderTemplate: TemplateRenderFn
