import axios from 'axios'

/** 小红书笔记 ID 解析结果 */
export interface XiaohongshuNoteId {
  type: 'note'
  note_id: string
  xsec_token?: string
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const normalizeRedirectPath = (value: string): string =>
  /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(value) ? value : safeDecode(value)

const findRedirectPath = (link: string): string | undefined => {
  try {
    const url = new URL(link)
    const redirectPath = url.searchParams.get('redirectPath')
    if (redirectPath) return normalizeRedirectPath(redirectPath)
  } catch {
    // Fall through to the regex fallback for incomplete URLs.
  }

  const redirectPath = /[?&]redirectPath=([^&#]+)/.exec(link)?.[1]
  return redirectPath ? normalizeRedirectPath(redirectPath) : undefined
}

export const resolveEffectiveLink = (link: string): string => {
  const redirectPath = findRedirectPath(link)
  if (redirectPath) return redirectPath

  const normalizedLink = safeDecode(link)
  const normalizedRedirectPath = normalizedLink === link ? undefined : findRedirectPath(normalizedLink)
  if (normalizedRedirectPath) return normalizedRedirectPath
  return normalizedLink
}

const pickToken = (link: string): string | undefined => {
  try {
    const url = new URL(link)
    const queryToken = url.searchParams.get('xsec_token') || url.searchParams.get('XSEC_TOKEN')
    if (queryToken) return queryToken
    const hashToken = /(?:^|[?&#])(?:xsec_token|XSEC_TOKEN)=([^&#]+)/.exec(url.hash)?.[1]
    return hashToken ? safeDecode(hashToken) : undefined
  } catch {
    const token = /(?:^|[?&#])(?:xsec_token|XSEC_TOKEN)=([^&#]+)/.exec(link)?.[1]
    return token ? safeDecode(token) : undefined
  }
}

/**
 * 解析小红书分享链接，提取笔记 ID 与 xsec_token。
 * @param url 小红书分享链接
 * @param log 是否打印解析结果
 */
export const getXiaohongshuID = async (url: string, log = true): Promise<XiaohongshuNoteId> => {
  const response = await axios.get(url, {
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Apifox/1.0.0 (https://apifox.com)'
    }
  }) as { request?: { res?: { responseUrl?: string } } }

  const longLink = response?.request?.res?.responseUrl || url
  const effectiveLink = resolveEffectiveLink(longLink)
  const normalizedLink = safeDecode(longLink)
  const normalizedInput = safeDecode(url)
  const token = pickToken(effectiveLink) || pickToken(normalizedLink) || pickToken(normalizedInput)
  const noteId = /xiaohongshu\.com\/(?:discovery\/item|explore)\/([0-9a-zA-Z]+)/.exec(effectiveLink)?.[1] ||
    /[?&]target_note_id=([0-9a-zA-Z]+)/.exec(effectiveLink)?.[1] ||
    /[?&]target_note_id=([0-9a-zA-Z]+)/.exec(normalizedLink)?.[1] ||
    /xiaohongshu\.com\/(?:discovery\/item|explore)\/([0-9a-zA-Z]+)/.exec(normalizedInput)?.[1]

  if (!noteId) throw new Error('无法从链接中提取小红书笔记ID')

  const result: XiaohongshuNoteId = {
    type: 'note',
    note_id: noteId,
    xsec_token: token
  }

  if (log) logger.debug(`[小红书] 链接解析结果: ${JSON.stringify(result)}`)
  return result
}
