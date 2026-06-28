const urlRegex = /https?:\/\/[-\w._~:/?#[\]@!$&'()*+,;=%]+/g

const linkColor = (useDarkTheme) => useDarkTheme ? '#58B0D5' : '#006A9E'

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const normalizeInputText = (text) => String(text || '').replace(/<br\s*\/?>/gi, '\n')

const buildColoredText = (text, useDarkTheme, title) => {
  const escaped = escapeHtml(text)
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
  return `<span class="bili-rich-text-node" style="color: ${linkColor(useDarkTheme)};"${titleAttr}>${escaped}</span>`
}

const buildEmoji = (text, emoji) => {
  const url = emoji?.gif_url || emoji?.icon_url
  if (!url) return escapeHtml(text)
  const scale = emoji?.size === 2 || emoji?.size === 3 ? 2 : 1
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}" style="height: ${scale === 2 ? 120 : 80}px; margin: 0 0 -14px 0;" />`
}

const parsePlainText = (text, useDarkTheme) => {
  const nodes = []
  const parts = String(text || '').split(/(\r?\n)/)

  for (const part of parts) {
    if (part === '\n' || part === '\r\n') {
      nodes.push('<br>')
      continue
    }
    if (!part) continue

    let lastIndex = 0
    for (const match of part.matchAll(urlRegex)) {
      if (match.index > lastIndex) nodes.push(escapeHtml(part.slice(lastIndex, match.index)))
      const url = match[0]
      nodes.push(buildColoredText(url, useDarkTheme, url))
      lastIndex = match.index + url.length
    }
    if (lastIndex < part.length) nodes.push(escapeHtml(part.slice(lastIndex)))
  }

  return nodes.join('')
}

const buildNodeHtml = (node, useDarkTheme) => {
  const matchText = node?.orig_text || node?.text || ''
  if (!matchText) return ''

  switch (node.type) {
    case 'RICH_TEXT_NODE_TYPE_TEXT':
      return parsePlainText(matchText, useDarkTheme)
    case 'topic':
    case 'RICH_TEXT_NODE_TYPE_TOPIC':
      return buildColoredText(matchText, useDarkTheme, '话题')
    case 'RICH_TEXT_NODE_TYPE_AT':
      return buildColoredText(matchText, useDarkTheme, '用户')
    case 'RICH_TEXT_NODE_TYPE_LOTTERY':
      return buildColoredText(matchText, useDarkTheme, '抽奖')
    case 'RICH_TEXT_NODE_TYPE_WEB':
      return buildColoredText(node.text || matchText, useDarkTheme, matchText)
    case 'RICH_TEXT_NODE_TYPE_EMOJI':
      return buildEmoji(matchText, node.emoji)
    case 'RICH_TEXT_NODE_TYPE_VOTE':
      return buildColoredText(node.text || matchText, useDarkTheme, '投票')
    case 'RICH_TEXT_NODE_TYPE_VIEW_PICTURE':
      return buildColoredText(matchText, useDarkTheme, '查看图片')
    default:
      return parsePlainText(matchText, useDarkTheme)
  }
}

/**
 * 将 B 站动态正文和 rich_text_nodes 转为 Yunzai 模板可直接渲染的 HTML 字符串。
 * @param {string} text 动态正文，允许传入已替换过的 <br>
 * @param {any[]} richTextNodes B 站 rich_text_nodes
 * @param {{ useDarkTheme?: boolean }} [options]
 * @returns {string}
 */
export const formatBilibiliDynamicText = (text, richTextNodes = [], options = {}) => {
  const rawText = normalizeInputText(text)
  const nodes = Array.isArray(richTextNodes) ? richTextNodes : []
  const useDarkTheme = Boolean(options.useDarkTheme)

  if (!nodes.length) return parsePlainText(rawText, useDarkTheme)

  if (!rawText) {
    return nodes.map(node => buildNodeHtml(node, useDarkTheme)).join('')
  }

  const result = []
  let currentPos = 0

  for (const node of nodes) {
    const matchText = node?.orig_text || node?.text || ''
    if (!matchText) continue

    const matchPos = rawText.indexOf(matchText, currentPos)
    if (matchPos === -1) continue

    if (matchPos > currentPos) {
      result.push(parsePlainText(rawText.slice(currentPos, matchPos), useDarkTheme))
    }

    result.push(buildNodeHtml(node, useDarkTheme))
    currentPos = matchPos + matchText.length
  }

  if (currentPos < rawText.length) {
    result.push(parsePlainText(rawText.slice(currentPos), useDarkTheme))
  }

  return result.join('')
}

export const formatBilibiliVideoDescText = (descV2 = [], fallback = '', options = {}) => {
  if (!Array.isArray(descV2) || descV2.length === 0) {
    return formatBilibiliDynamicText(fallback, [], options)
  }

  const nodes = descV2.map(item => {
    const rawText = item?.raw_text || ''
    if (item?.type === 2) {
      return {
        type: 'RICH_TEXT_NODE_TYPE_AT',
        orig_text: rawText.startsWith('@') ? rawText : `@${rawText}`,
        text: rawText.startsWith('@') ? rawText : `@${rawText}`
      }
    }
    return {
      type: 'RICH_TEXT_NODE_TYPE_TEXT',
      orig_text: rawText,
      text: rawText
    }
  })

  return formatBilibiliDynamicText('', nodes, options)
}

export const getHotBilibiliDanmaku = (danmakuList = [], limit = 20) => {
  const countMap = new Map()
  for (const item of danmakuList) {
    const content = String(item?.content || '').trim()
    if (!content) continue
    countMap.set(content, (countMap.get(content) || 0) + 1)
  }

  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([content, count]) => ({ content, count }))
}
