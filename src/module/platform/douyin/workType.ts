import { isRecord } from '@/module/utils/record'
/** 抖音作品中被类型判定读取的字段 */
export interface DouyinAweme {
  aweme_type?: number
  article_info?: {
    fe_data?: string
    article_content?: string
  }
  video?: {
    animated_cover?: { url_list?: string[] }
    dynamic_cover?: { url_list?: string[] }
    cover_original_scale?: { url_list?: string[] }
    cover?: { url_list?: string[] }
    origin_cover?: { url_list?: string[] }
  }
  images?: Array<{ url_list?: string[] }>
}

interface ArticleFeData {
  image_list?: Array<{ url_list?: string[], url?: string }>
}

interface ArticleContent {
  head_poster_list?: { url_list?: string[] }
}

export const parseJsonSafely = <T = Record<string, unknown>>(
  text: string | undefined,
  fallback: T = {} as T
): T => {
  try {
    return JSON.parse(text || '{}') as T
  } catch {
    return fallback
  }
}

export const isDouyinArticle = (aweme: DouyinAweme | undefined): boolean =>
  aweme?.aweme_type === 163 || Boolean(aweme?.article_info)

export const isDouyinVideo = (aweme: DouyinAweme | undefined): boolean => !isDouyinArticle(aweme) && (
  aweme?.aweme_type === 0 ||
  aweme?.aweme_type === 55 ||
  (Boolean(aweme?.video) && !((aweme?.images?.length ?? 0) > 0))
)

export const isDouyinImage = (aweme: DouyinAweme | undefined): boolean =>
  !isDouyinArticle(aweme) && !isDouyinVideo(aweme) && (aweme?.images?.length ?? 0) > 0

/**
 * 抖音图床低分辨率处理模板（如 `~tplv-dy-360p.jpeg`），命中说明该封面 URL 被 CDN 降质。
 * 详情接口没有 animated_cover，取封面会落到 cover_original_scale，而它的 url_list[0]
 * 常是这类降质模板；签名绑定在路径上，改 URL 无法还原原图，只能换一个没被降质的候选。
 */
const LOW_RES_COVER_PATTERN = /~tplv-[^/?]*(?:270p|360p|480p|540p)/i

export const getDouyinWorkCoverUrl = (aweme: DouyinAweme | undefined): string => {
  if (isDouyinVideo(aweme)) {
    // 按既有优先级把所有候选 URL 摊平后，优先取未命中低清模板的；全部命中时才退回第一个兜底。
    // 旧实现直接取第一个字段的 url_list[0]，命中 cover_original_scale 的降质模板时就把糊图当封面。
    const candidates = [
      aweme?.video?.animated_cover,
      aweme?.video?.dynamic_cover,
      aweme?.video?.cover_original_scale,
      aweme?.video?.cover,
      aweme?.video?.origin_cover
    ].flatMap(field => field?.url_list ?? [])
    return candidates.find(url => !LOW_RES_COVER_PATTERN.test(url)) ?? candidates[0] ?? ''
  }

  if (isDouyinImage(aweme)) {
    return aweme?.images?.[0]?.url_list?.[2] ||
      aweme?.images?.[0]?.url_list?.[1] ||
      aweme?.images?.[0]?.url_list?.[0] ||
      ''
  }

  if (isDouyinArticle(aweme)) {
    const feData = parseJsonSafely<ArticleFeData>(aweme?.article_info?.fe_data)
    const content = parseJsonSafely<ArticleContent>(aweme?.article_info?.article_content)
    return feData?.image_list?.[0]?.url_list?.[0] ||
      feData?.image_list?.[0]?.url ||
      content?.head_poster_list?.url_list?.[0] ||
      aweme?.video?.cover?.url_list?.[0] ||
      ''
  }

  return ''
}

/**
 * 文章配图 → `douyin/article-work` 契约的 `images`。
 *
 * `fe_data.image_list` 是从 JSON 字符串里解出来的 `unknown[]`，而契约那四个 URL 字段都是必填。
 * 模板拿 `markdown_url` 当键，把正文 markdown 里的图换成 `ai_high_image_url` 这些高清版，
 * 所以缺了 `markdown_url` 的项换不了图，直接丢掉。
 */
export const normalizeArticleImages = (imageList: unknown[] | undefined) => {
  const pick = (record: Record<string, unknown>, key: string): string =>
    typeof record[key] === 'string' ? record[key] as string : ''
  return (Array.isArray(imageList) ? imageList : [])
    .filter(isRecord)
    .map(record => ({
      ai_high_image_url: pick(record, 'ai_high_image_url'),
      high_image_url: pick(record, 'high_image_url'),
      markdown_url: pick(record, 'markdown_url'),
      origin_image_url: pick(record, 'origin_image_url')
    }))
    .filter(image => image.markdown_url)
}
