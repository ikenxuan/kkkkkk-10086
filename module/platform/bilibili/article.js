const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const fixImageUrl = (url) => {
  if (!url) return ''
  return String(url).startsWith('//') ? `https:${url}` : String(url)
}

const normalizeInlineText = (text) => escapeHtml(text).replace(/\r?\n/g, '<br>')

const buildInlineStyle = (word = {}, useDarkTheme) => {
  const styles = []
  const style = word.style || {}
  if (style.bold) styles.push('font-weight: 700')
  if (style.italic) styles.push('font-style: italic')
  if (style.strike) styles.push('text-decoration: line-through')
  const color = useDarkTheme ? word.dark_color : word.color
  if (color) styles.push(`color: ${color}`)
  return styles.length ? ` style="${styles.join('; ')}"` : ''
}

const formatOpusInlineNodes = (nodes = [], useDarkTheme) => {
  const parts = []
  for (const node of nodes) {
    if (node?.node_type !== 1 || !node.word) continue
    const words = node.word.words || ''
    if (!words) continue
    parts.push(`<span${buildInlineStyle(node.word, useDarkTheme)}>${normalizeInlineText(words)}</span>`)
  }
  return parts.join('')
}

const formatOpusParagraph = (paragraph, useDarkTheme) => {
  const paraType = paragraph?.para_type

  if (paraType === 2) {
    const pics = paragraph?.pic?.pics || []
    return pics
      .map(pic => {
        const url = fixImageUrl(pic.url)
        return url ? `<img class="article-body-image" src="${escapeHtml(url)}" alt="${escapeHtml(pic.alt || '专栏图片')}" />` : ''
      })
      .join('')
  }

  if (paraType === 3) return '<hr class="article-divider" />'

  if (paraType === 7) {
    const card = paragraph?.link_card?.card
    if (!card?.link) return ''
    const text = card.show_text || paragraph?.link_card?.default_text || '链接卡片'
    return `<div class="article-link-card">${escapeHtml(text)}</div>`
  }

  if (paraType === 8) {
    const code = paragraph?.code
    return code?.content ? `<pre class="article-code">${escapeHtml(code.content)}</pre>` : ''
  }

  const text = formatOpusInlineNodes(paragraph?.text?.nodes || [], useDarkTheme)
  if (!text) return ''

  if (paraType === 4) return `<blockquote class="article-blockquote">${text}</blockquote>`
  if (paraType === 9 || paragraph?.format?.heading_type) return `<h2 class="article-heading">${text}</h2>`
  return `<p class="article-paragraph">${text}</p>`
}

const sanitizeHtmlContent = (content) => {
  if (!content) return ''
  return String(content)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/src="\/\//gi, 'src="https://')
    .replace(/href="\/\//gi, 'href="https://')
    .replace(/<(\/?)(section|article|div)[^>]*>/gi, '<$1p>')
    .replace(/<img\b([^>]*)>/gi, (_, attrs) => {
      const src = /src="([^"]+)"/i.exec(attrs)?.[1]
      return src ? `<img class="article-body-image" src="${escapeHtml(fixImageUrl(src))}" alt="专栏图片" />` : ''
    })
    .replace(/<(?!\/?(p|br|h1|h2|h3|h4|h5|h6|blockquote|ul|ol|li|strong|b|em|i|s|del|code|pre|img|hr)\b)[^>]*>/gi, '')
}

export const formatBilibiliArticleBody = (articleContent, options = {}) => {
  const useDarkTheme = Boolean(options.useDarkTheme)
  const paragraphs = articleContent?.opus?.content?.paragraphs
  if (Array.isArray(paragraphs) && paragraphs.length) {
    return paragraphs.map(paragraph => formatOpusParagraph(paragraph, useDarkTheme)).filter(Boolean).join('')
  }
  return sanitizeHtmlContent(articleContent?.content || '')
}

export const extractBilibiliArticleImages = (articleContent) => {
  const images = []
  const paragraphs = articleContent?.opus?.content?.paragraphs
  if (Array.isArray(paragraphs)) {
    for (const paragraph of paragraphs) {
      if (paragraph?.para_type !== 2 || !Array.isArray(paragraph?.pic?.pics)) continue
      for (const pic of paragraph.pic.pics) {
        const url = fixImageUrl(pic.url)
        if (url) images.push(url)
      }
    }
  }

  const html = articleContent?.content
  if (typeof html === 'string') {
    const imgRegex = /<img[^>]+src="([^"]+)"/gi
    let match
    while ((match = imgRegex.exec(html)) !== null) {
      const url = fixImageUrl(match[1])
      if (url) images.push(url)
    }
  }

  return [...new Set(images)]
}
