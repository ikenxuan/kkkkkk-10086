import axios from 'axios'

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const resolveEffectiveLink = (link) => {
  const normalized = safeDecode(link)

  try {
    const url = new URL(normalized)
    const redirectPath = url.searchParams.get('redirectPath')
    if (url.pathname.startsWith('/404') && redirectPath) return safeDecode(redirectPath)
    return normalized
  } catch {
    const match = /[?&]redirectPath=([^&#]+)/.exec(normalized)
    return match?.[1] ? safeDecode(match[1]) : normalized
  }
}

const pickToken = (link) => {
  try {
    const url = new URL(link)
    return url.searchParams.get('xsec_token') || url.searchParams.get('XSEC_TOKEN') || undefined
  } catch {
    return /(?:^|[?&#])(?:xsec_token|XSEC_TOKEN)=([^&#]+)/.exec(link)?.[1]
  }
}

/**
 * 解析小红书分享链接，提取笔记 ID 与 xsec_token。
 * @param {string} url 小红书分享链接
 * @param {boolean} [log=true] 是否打印解析结果
 * @returns {Promise<{type: 'note', note_id: string, xsec_token?: string}>}
 */
export const getXiaohongshuID = async (url, log = true) => {
  const response = await axios.get(url, {
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Apifox/1.0.0 (https://apifox.com)'
    }
  })

  const longLink = response?.request?.res?.responseUrl || url
  const effectiveLink = resolveEffectiveLink(longLink)
  const token = pickToken(effectiveLink) || pickToken(longLink)
  const noteId = /xiaohongshu\.com\/(?:discovery\/item|explore)\/([0-9a-zA-Z]+)/.exec(effectiveLink)?.[1]

  if (!noteId) throw new Error('无法从链接中提取小红书笔记ID')

  const result = {
    type: 'note',
    note_id: noteId,
    xsec_token: token
  }

  if (log) logger.debug(`[小红书] 链接解析结果: ${JSON.stringify(result)}`)
  return result
}
