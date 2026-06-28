export const parseJsonSafely = (text, fallback = {}) => {
  try {
    return JSON.parse(text || '{}')
  } catch {
    return fallback
  }
}

export const isDouyinArticle = (aweme) => aweme?.aweme_type === 163 || Boolean(aweme?.article_info)

export const isDouyinVideo = (aweme) => !isDouyinArticle(aweme) && (
  aweme?.aweme_type === 0 ||
  aweme?.aweme_type === 55 ||
  (Boolean(aweme?.video) && !(aweme?.images?.length > 0))
)

export const isDouyinImage = (aweme) => !isDouyinArticle(aweme) && !isDouyinVideo(aweme) && aweme?.images?.length > 0

export const getDouyinWorkCoverUrl = (aweme) => {
  if (isDouyinVideo(aweme)) {
    return aweme?.video?.animated_cover?.url_list?.[0] ||
      aweme?.video?.dynamic_cover?.url_list?.[0] ||
      aweme?.video?.cover_original_scale?.url_list?.[0] ||
      aweme?.video?.cover?.url_list?.[0] ||
      aweme?.video?.origin_cover?.url_list?.[0] ||
      ''
  }

  if (isDouyinImage(aweme)) {
    return aweme?.images?.[0]?.url_list?.[2] ||
      aweme?.images?.[0]?.url_list?.[1] ||
      aweme?.images?.[0]?.url_list?.[0] ||
      ''
  }

  if (isDouyinArticle(aweme)) {
    const feData = parseJsonSafely(aweme?.article_info?.fe_data)
    const content = parseJsonSafely(aweme?.article_info?.article_content)
    return feData?.image_list?.[0]?.url_list?.[0] ||
      feData?.image_list?.[0]?.url ||
      content?.head_poster_list?.url_list?.[0] ||
      aweme?.video?.cover?.url_list?.[0] ||
      ''
  }

  return ''
}
