import {
  createAtNode,
  createEmojiNode,
  createLineBreakNode,
  createLotteryNode,
  createRichTextDocument,
  createTextNode,
  createTopicNode,
  createViewPictureNode,
  createVoteNode,
  createWebLinkNode,
  type RichTextDocument,
  type RichTextNode
} from '@kkk/richtext'

const urlRegex = /https?:\/\/[-\w._~:/?#[\]@!$&'()*+,;=%]+/g

/** B站表情节点，仅声明本文件读取的字段 */
export interface BilibiliRichTextEmoji {
  gif_url?: string
  icon_url?: string
  size?: number
}

/** B站富文本节点，仅声明本文件读取的字段 */
export interface BilibiliRichTextNode {
  type?: string
  text?: string
  orig_text?: string
  emoji?: BilibiliRichTextEmoji
}

/** 视频简介 desc_v2 节点，仅声明本文件读取的字段 */
export interface BilibiliDescV2Item {
  type?: number
  raw_text?: string
}

/** 弹幕条目，仅声明本文件读取的字段 */
export interface BilibiliDanmakuItem {
  content?: string
}

/** 渲染选项 */
export interface BilibiliDynamicTextOptions {
  useDarkTheme?: boolean
}

/** React 模板使用的用户名元数据，避免把带 HTML 的旧 username 字符串传入模板。 */
export const getUsernameMetadata = (member: {
  name?: string
  vip?: {
    status?: number
    nickname_color?: string
  }
}) => {
  const vipStatus = member.vip?.status ?? 0
  const nicknameColor = vipStatus === 1 && member.vip?.nickname_color
    ? member.vip.nickname_color
    : null

  return {
    name: member.name ?? '',
    vipStatus,
    nicknameColor
  }
}

const linkColor = (useDarkTheme: boolean): string => useDarkTheme ? '#58B0D5' : '#006A9E'

const escapeHtml = (value: string | number | undefined | null): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const normalizeInputText = (text: string | undefined): string => String(text || '').replace(/<br\s*\/?>/gi, '\n')

const buildColoredText = (text: string, useDarkTheme: boolean, title?: string): string => {
  const escaped = escapeHtml(text)
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
  return `<span class="bili-rich-text-node" style="color: ${linkColor(useDarkTheme)};"${titleAttr}>${escaped}</span>`
}

const buildEmoji = (text: string, emoji?: BilibiliRichTextEmoji): string => {
  const url = emoji?.gif_url || emoji?.icon_url
  if (!url) return escapeHtml(text)
  const scale = emoji?.size === 2 || emoji?.size === 3 ? 2 : 1
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}" style="height: ${scale === 2 ? 120 : 80}px; margin: 0 0 -14px 0;" />`
}

const parsePlainText = (text: string | undefined, useDarkTheme: boolean): string => {
  const nodes: string[] = []
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

const buildNodeHtml = (node: BilibiliRichTextNode | undefined, useDarkTheme: boolean): string => {
  const matchText = node?.orig_text || node?.text || ''
  if (!matchText) return ''

  switch (node?.type) {
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
      return buildColoredText(node?.text || matchText, useDarkTheme, matchText)
    case 'RICH_TEXT_NODE_TYPE_EMOJI':
      return buildEmoji(matchText, node?.emoji)
    case 'RICH_TEXT_NODE_TYPE_VOTE':
      return buildColoredText(node?.text || matchText, useDarkTheme, '投票')
    case 'RICH_TEXT_NODE_TYPE_VIEW_PICTURE':
      return buildColoredText(matchText, useDarkTheme, '查看图片')
    default:
      return parsePlainText(matchText, useDarkTheme)
  }
}

/**
 * 将 B 站动态正文和 rich_text_nodes 转为 Yunzai 模板可直接渲染的 HTML 字符串。
 * @param text 动态正文，允许传入已替换过的 <br>
 * @param richTextNodes B 站 rich_text_nodes
 * @param options 渲染选项
 */
export const formatBilibiliDynamicText = (
  text: string | undefined,
  richTextNodes: BilibiliRichTextNode[] | undefined = [],
  options: BilibiliDynamicTextOptions = {}
): string => {
  const rawText = normalizeInputText(text)
  const nodes = Array.isArray(richTextNodes) ? richTextNodes : []
  const useDarkTheme = Boolean(options.useDarkTheme)

  if (!nodes.length) return parsePlainText(rawText, useDarkTheme)

  if (!rawText) {
    return nodes.map(node => buildNodeHtml(node, useDarkTheme)).join('')
  }

  const result: string[] = []
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

/**
 * 将视频简介的 desc_v2 结构转为可渲染的 HTML 字符串
 * @param descV2 视频简介节点列表
 * @param fallback desc_v2 缺失时使用的纯文本简介
 * @param options 渲染选项
 */
export const formatBilibiliVideoDescText = (
  descV2: BilibiliDescV2Item[] | undefined = [],
  fallback = '',
  options: BilibiliDynamicTextOptions = {}
): string => {
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

/**
 * 纯文本 → 富文本节点：换行拆成 lineBreak，裸 URL 拆成 webLink，其余是 text。
 *
 * 对应 HTML 版的 {@link parsePlainText}，但不再自己往里塞颜色 ——
 * 配色是模板的事（`renderRichTextToReact` 按节点类型上样式），
 * 生产方只负责说清「这段是链接」而不是「这段是 #006A9E」。
 */
const buildPlainTextNodes = (text: string | undefined): RichTextNode[] => {
  const nodes: RichTextNode[] = []
  const parts = String(text || '').split(/(\r?\n)/)

  for (const part of parts) {
    if (part === '\n' || part === '\r\n') {
      nodes.push(createLineBreakNode())
      continue
    }
    if (!part) continue

    let lastIndex = 0
    for (const match of part.matchAll(urlRegex)) {
      if (match.index > lastIndex) nodes.push(createTextNode(part.slice(lastIndex, match.index)))
      const url = match[0]
      nodes.push(createWebLinkNode(url, url))
      lastIndex = match.index + url.length
    }
    if (lastIndex < part.length) nodes.push(createTextNode(part.slice(lastIndex)))
  }

  return nodes
}

/** B 站富文本节点 → 富文本节点，逐类对应 {@link buildNodeHtml} 的那个 switch */
const buildRichTextNodes = (node: BilibiliRichTextNode | undefined): RichTextNode[] => {
  const matchText = node?.orig_text || node?.text || ''
  if (!matchText) return []

  switch (node?.type) {
    case 'topic':
    case 'RICH_TEXT_NODE_TYPE_TOPIC':
      return [createTopicNode(matchText)]
    case 'RICH_TEXT_NODE_TYPE_AT':
      return [createAtNode(matchText)]
    case 'RICH_TEXT_NODE_TYPE_LOTTERY':
      return [createLotteryNode(matchText)]
    case 'RICH_TEXT_NODE_TYPE_WEB':
      // HTML 版把 orig_text 放 title、text 放正文，富文本里正好是 jumpUrl 和 text
      return [createWebLinkNode(node?.text || matchText, matchText)]
    case 'RICH_TEXT_NODE_TYPE_EMOJI': {
      const url = node?.emoji?.gif_url || node?.emoji?.icon_url
      // 拿不到图就退回文字，跟 HTML 版的 buildEmoji 一致
      if (!url) return [createTextNode(matchText)]
      return [createEmojiNode(matchText, url, {
        scale: node?.emoji?.size === 2 || node?.emoji?.size === 3 ? 2 : 1
      })]
    }
    case 'RICH_TEXT_NODE_TYPE_VOTE':
      return [createVoteNode(node?.text || matchText)]
    case 'RICH_TEXT_NODE_TYPE_VIEW_PICTURE':
      return [createViewPictureNode(matchText)]
    case 'RICH_TEXT_NODE_TYPE_TEXT':
    default:
      return buildPlainTextNodes(matchText)
  }
}

/**
 * 把 B 站动态正文 + rich_text_nodes 转成 React 模板要的 {@link RichTextDocument}。
 *
 * 这是 {@link formatBilibiliDynamicText} 的富文本版。那个返回 HTML 字符串，是
 * art-template 时代的产物；React 模板拿到字符串会在 `document.nodes.map()` 上当场抛
 * `Cannot read properties of undefined (reading 'map')`（实测复现过）。
 * 交织逻辑跟 HTML 版逐行对齐，只把「拼字符串」换成「push 节点」。
 *
 * @param text 动态正文，允许传入已替换过的 `<br>`
 * @param richTextNodes B 站 rich_text_nodes
 */
export const formatBilibiliDynamicRichText = (
  text: string | undefined,
  richTextNodes: BilibiliRichTextNode[] | undefined = []
): RichTextDocument => {
  const rawText = normalizeInputText(text)
  const nodes = Array.isArray(richTextNodes) ? richTextNodes : []
  const toDocument = (result: RichTextNode[]): RichTextDocument =>
    createRichTextDocument(result, { platform: 'bilibili' })

  if (!nodes.length) return toDocument(buildPlainTextNodes(rawText))
  if (!rawText) return toDocument(nodes.flatMap(node => buildRichTextNodes(node)))

  const result: RichTextNode[] = []
  let currentPos = 0

  for (const node of nodes) {
    const matchText = node?.orig_text || node?.text || ''
    if (!matchText) continue

    const matchPos = rawText.indexOf(matchText, currentPos)
    if (matchPos === -1) continue

    if (matchPos > currentPos) {
      result.push(...buildPlainTextNodes(rawText.slice(currentPos, matchPos)))
    }

    result.push(...buildRichTextNodes(node))
    currentPos = matchPos + matchText.length
  }

  if (currentPos < rawText.length) {
    result.push(...buildPlainTextNodes(rawText.slice(currentPos)))
  }

  return toDocument(result)
}

/**
 * 视频简介 desc_v2 → {@link RichTextDocument}，{@link formatBilibiliVideoDescText} 的富文本版。
 *
 * `bilibili/videoInfo` 的契约要的就是这个类型。之前传的是 HTML 字符串版，
 * 结果只要视频有简介就必炸（实测 success=false）。
 *
 * @param descV2 视频简介节点列表
 * @param fallback desc_v2 缺失时使用的纯文本简介
 */
export const formatBilibiliVideoDescRichText = (
  descV2: BilibiliDescV2Item[] | undefined = [],
  fallback = ''
): RichTextDocument => {
  if (!Array.isArray(descV2) || descV2.length === 0) {
    return formatBilibiliDynamicRichText(fallback, [])
  }

  return formatBilibiliDynamicRichText('', descV2.map(item => {
    const rawText = item?.raw_text || ''
    // type 2 是 @ 用户，B 站这里的 raw_text 有时带 @ 有时不带
    if (item?.type === 2) {
      const atText = rawText.startsWith('@') ? rawText : `@${rawText}`
      return { type: 'RICH_TEXT_NODE_TYPE_AT', orig_text: atText, text: atText }
    }
    return { type: 'RICH_TEXT_NODE_TYPE_TEXT', orig_text: rawText, text: rawText }
  }))
}

/** 表情表条目，`push.ts` 的 `extractEmojisData` 的产物 */
export interface BilibiliEmojiTableItem {
  text?: string
  url?: string
}

/**
 * 用表情表把富文本里残留的 `[表情名]` 字面量换成 emoji 节点。
 *
 * B 站的 `rich_text_nodes` 通常已经给出 `RICH_TEXT_NODE_TYPE_EMOJI`，那条路
 * {@link formatBilibiliDynamicRichText} 里已经走通了；这里兜的是只给纯文本的那种响应。
 * 命中不了表情表就原样返回，所以对已有 emoji 节点的文档是个空操作。
 *
 * 顺带修掉 HTML 版的一个 bug：那边是
 * `text.replace(/\[[^\]]*\]/g, '<img src="${item.url}"/>')`，
 * 一次匹配把**所有**方括号片段都换成同一个表情的图，动态里出现两种表情就全渲染成第一种。
 * 这里按 `[名字]` 逐个查表，查不到的保持原文。
 *
 * @param document 已构建好的富文本文档
 * @param emojis 表情表
 */
export const applyBilibiliEmojiTable = (
  document: RichTextDocument,
  emojis: BilibiliEmojiTableItem[] | undefined
): RichTextDocument => {
  const table = new Map<string, string>()
  for (const item of emojis ?? []) {
    if (item?.text && item?.url) table.set(item.text, item.url)
  }
  if (table.size === 0) return document

  const nodes: RichTextNode[] = []
  for (const node of document.nodes) {
    if (node.type !== 'text' || !node.text.includes('[')) {
      nodes.push(node)
      continue
    }

    const replaced: RichTextNode[] = []
    let lastIndex = 0
    for (const match of node.text.matchAll(/\[[^[\]]+\]/g)) {
      const url = table.get(match[0])
      if (!url) continue
      if (match.index > lastIndex) replaced.push(createTextNode(node.text.slice(lastIndex, match.index), node.style))
      replaced.push(createEmojiNode(match[0], url))
      lastIndex = match.index + match[0].length
    }

    // 一个都没命中就别拆，保留原节点连带它的样式
    if (!replaced.length) {
      nodes.push(node)
      continue
    }
    if (lastIndex < node.text.length) replaced.push(createTextNode(node.text.slice(lastIndex), node.style))
    nodes.push(...replaced)
  }

  return createRichTextDocument(nodes, { platform: document.platform })
}

/** 专栏分类原始条目，B站 `viewinfo` 给的是对象，老代码也可能拿到裸字符串 */
export type BilibiliArticleCategoryInput =
  | { id?: number | string, name?: string, parent_id?: number | string }
  | string

/** 专栏分类，`DYNAMIC_TYPE_ARTICLE` 契约要的形状 */
export interface BilibiliArticleCategory {
  id: number
  name: string
  parent_id: number
}

/**
 * 把专栏分类整理成模板要的形状。
 *
 * 之前两个调用点都是 `.map(item => item.name).filter(Boolean)`，
 * 结果给出去的是 `(string | undefined)[]`，而契约要的是 `{id, name, parent_id}[]`。
 * B站接口本来就返回带 id 的对象，直接留着，别在调用点各写一份。
 *
 * @param categories 接口返回的分类列表
 */
export const buildBilibiliArticleCategories = (
  categories: BilibiliArticleCategoryInput[] | undefined
): BilibiliArticleCategory[] => {
  if (!Array.isArray(categories)) return []

  const result: BilibiliArticleCategory[] = []
  for (const item of categories) {
    if (typeof item === 'string') {
      if (item) result.push({ id: 0, name: item, parent_id: 0 })
      continue
    }
    if (!item?.name) continue
    result.push({
      id: Number(item.id) || 0,
      name: item.name,
      parent_id: Number(item.parent_id) || 0
    })
  }
  return result
}

/**
 * 统计弹幕出现次数，返回按热度排序的前 limit 条
 * @param danmakuList 弹幕列表
 * @param limit 返回条数
 */
export const getHotBilibiliDanmaku = (
  danmakuList: BilibiliDanmakuItem[] = [],
  limit = 20
): Array<{ content: string, count: number }> => {
  const countMap = new Map<string, number>()
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

/** B 站专栏解析使用的宿主无关富文本文档。 */
export interface BilibiliArticleRichTextInlineStyle {
  bold?: boolean
  italic?: boolean
  strike?: boolean
  color?: string
  link?: string
  fontSize?: string
}

export interface BilibiliArticleRichTextTextNode {
  type: 'text'
  text: string
  style?: BilibiliArticleRichTextInlineStyle
}

export interface BilibiliArticleRichTextLineBreakNode { type: 'lineBreak' }
export interface BilibiliArticleRichTextEmojiNode {
  type: 'emoji'
  name: string
  src: string
  scale?: number
}
export interface BilibiliArticleRichTextMentionNode { type: 'mention', text: string, userId?: string }
export interface BilibiliArticleRichTextSearchKeywordNode { type: 'searchKeyword', text: string, queryId?: string }
export interface BilibiliArticleRichTextTopicNode { type: 'topic', text: string }
export interface BilibiliArticleRichTextAtNode { type: 'at', text: string, userId?: string }
export interface BilibiliArticleRichTextLotteryNode { type: 'lottery', text: string }
export interface BilibiliArticleRichTextWebLinkNode { type: 'webLink', text: string, jumpUrl: string }
export interface BilibiliArticleRichTextVoteNode { type: 'vote', text: string }
export interface BilibiliArticleRichTextViewPictureNode { type: 'viewPicture', text: string }
export interface BilibiliArticleRichTextHashtagNode { type: 'hashtag', text: string }

export interface BilibiliArticleRichTextHeadingNode {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  nodes: BilibiliArticleRichTextNode[]
}
export interface BilibiliArticleRichTextParagraphNode {
  type: 'paragraph'
  nodes: BilibiliArticleRichTextNode[]
}
export interface BilibiliArticleRichTextImageNode {
  type: 'image'
  src: string
  alt?: string
  caption?: string
}
export interface BilibiliArticleRichTextHorizontalRuleNode { type: 'horizontalRule' }
export interface BilibiliArticleRichTextBlockquoteNode {
  type: 'blockquote'
  nodes: BilibiliArticleRichTextNode[]
}
export interface BilibiliArticleRichTextListItemNode {
  type: 'listItem'
  nodes: BilibiliArticleRichTextNode[]
}
export interface BilibiliArticleRichTextListNode {
  type: 'list'
  ordered: boolean
  items: BilibiliArticleRichTextListItemNode[]
}
export interface BilibiliArticleRichTextCodeBlockNode {
  type: 'codeBlock'
  language?: string
  content: string
}
export interface BilibiliArticleRichTextLinkCardNode {
  type: 'linkCard'
  title: string
  url: string
  cardType?: string
  meta?: Record<string, unknown>
}

export type BilibiliArticleRichTextInlineNode =
  | BilibiliArticleRichTextTextNode
  | BilibiliArticleRichTextEmojiNode
  | BilibiliArticleRichTextMentionNode
  | BilibiliArticleRichTextSearchKeywordNode
  | BilibiliArticleRichTextLineBreakNode
  | BilibiliArticleRichTextTopicNode
  | BilibiliArticleRichTextAtNode
  | BilibiliArticleRichTextLotteryNode
  | BilibiliArticleRichTextWebLinkNode
  | BilibiliArticleRichTextVoteNode
  | BilibiliArticleRichTextViewPictureNode
  | BilibiliArticleRichTextHashtagNode

export type BilibiliArticleRichTextBlockNode =
  | BilibiliArticleRichTextHeadingNode
  | BilibiliArticleRichTextParagraphNode
  | BilibiliArticleRichTextImageNode
  | BilibiliArticleRichTextBlockquoteNode
  | BilibiliArticleRichTextListNode
  | BilibiliArticleRichTextListItemNode
  | BilibiliArticleRichTextCodeBlockNode
  | BilibiliArticleRichTextLinkCardNode
  | BilibiliArticleRichTextHorizontalRuleNode

export type BilibiliArticleRichTextNode =
  | BilibiliArticleRichTextInlineNode
  | BilibiliArticleRichTextBlockNode

export interface BilibiliArticleRichTextDocument {
  version: 1
  platform?: string
  nodes: BilibiliArticleRichTextNode[]
}

/** B 站 opus 文字样式；只声明解析层会读取的字段。 */
export interface BilibiliArticleOpusWordStyle extends BilibiliArticleRichTextInlineStyle {
  list?: string | number | boolean
  header?: number | boolean
}

/** B 站 opus 文字节点；保持结构宽松以兼容接口字段增减。 */
export interface BilibiliArticleOpusWord {
  words?: string
  style?: BilibiliArticleOpusWordStyle
  color?: string
  dark_color?: string
  font_size?: number | string
  font_level?: string
  [key: string]: unknown
}

export interface BilibiliArticleOpusTextNode {
  node_type?: number
  word?: BilibiliArticleOpusWord
  [key: string]: unknown
}

export interface BilibiliArticleOpusPic {
  url?: string
  alt?: string
  comment?: string
  [key: string]: unknown
}

export interface BilibiliArticleOpusParagraph {
  para_type?: number
  pic?: { pics?: BilibiliArticleOpusPic[] }
  link_card?: {
    default_text?: string
    card?: {
      link?: string
      show_text?: string
      link_type?: string | number
      biz_id?: unknown
      content_card?: unknown
    }
  }
  code?: { content?: string, lang?: string }
  text?: { nodes?: BilibiliArticleOpusTextNode[] }
  format?: { heading_type?: number }
  [key: string]: unknown
}

export interface BilibiliArticleOpus {
  content?: { paragraphs?: BilibiliArticleOpusParagraph[] }
  [key: string]: unknown
}

/** 主代理可直接映射为 segment.text / segment.image 的消息节点。 */
export type BilibiliRichTextForwardNode =
  | { type: 'text', text: string }
  | { type: 'image', src: string, alt?: string, caption?: string }

export interface BilibiliRichTextForwardOptions {
  title?: string
  summary?: string
  shareUrl?: string
  maxTextLength?: number
  imageResolver?: (
    src: string,
    index: number
  ) => Promise<string | null | undefined> | string | null | undefined
}

interface ArticleHtmlTextNode {
  kind: 'text'
  value: string
}

interface ArticleHtmlElementNode {
  kind: 'element'
  tag: string
  attrs: Record<string, string>
  children: ArticleHtmlTreeNode[]
}

type ArticleHtmlTreeNode = ArticleHtmlTextNode | ArticleHtmlElementNode

const ARTICLE_VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
])

const ARTICLE_IGNORED_HTML_TAGS = new Set(['script', 'style', 'noscript', 'template'])

const ARTICLE_BLOCK_HTML_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div',
  'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'header',
  'hgroup', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul'
])

const createBilibiliArticleDocument = (
  nodes: BilibiliArticleRichTextNode[] = []
): BilibiliArticleRichTextDocument => ({
  version: 1,
  platform: 'bilibili',
  nodes
})

const articleTextNode = (
  text: string,
  style?: BilibiliArticleRichTextInlineStyle
): BilibiliArticleRichTextNode => Object.keys(style || {}).length > 0
  ? { type: 'text', text, style }
  : { type: 'text', text }

const decodeArticleHtmlEntities = (value: string): string => {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: '\u00a0', quot: '"'
  }

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const hexadecimal = body[1]?.toLowerCase() === 'x'
      const source = body.slice(hexadecimal ? 2 : 1)
      const codePoint = Number.parseInt(source, hexadecimal ? 16 : 10)
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) return entity
      if (codePoint >= 0xD800 && codePoint <= 0xDFFF) return '\uFFFD'
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return entity
      }
    }
    return named[body.toLowerCase()] ?? entity
  })
}

const normalizeArticleImageUrl = (value: unknown): string => {
  const url = decodeArticleHtmlEntities(String(value || '')).trim()
  if (!url || /^(?:javascript|vbscript):/i.test(url)) return ''
  return url.startsWith('//') ? `https:${url}` : url
}

const normalizeArticleLinkUrl = (value: unknown): string => {
  const url = decodeArticleHtmlEntities(String(value || '')).trim()
  if (!url || /^(?:javascript|vbscript):/i.test(url)) return ''
  return url.startsWith('//') ? `https:${url}` : url
}

const parseArticleHtmlAttributes = (source: string): Record<string, string> => {
  const attrs: Record<string, string> = {}
  const attrRegex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null

  while ((match = attrRegex.exec(source)) !== null) {
    const key = (match[1] || '').toLowerCase()
    attrs[key] = decodeArticleHtmlEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attrs
}

const parseArticleHtmlTree = (content: string): ArticleHtmlElementNode => {
  const root: ArticleHtmlElementNode = { kind: 'element', tag: '#root', attrs: {}, children: [] }
  const stack: ArticleHtmlElementNode[] = [root]
  const sanitized = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  const tokenRegex = /<![^>]*>|<\/?[a-z][^>]*>|[^<]+|</gi
  let tokenMatch: RegExpExecArray | null

  while ((tokenMatch = tokenRegex.exec(sanitized)) !== null) {
    const token = tokenMatch[0]
    const parent = stack[stack.length - 1] || root
    if (!token.startsWith('<') || token === '<') {
      parent.children.push({ kind: 'text', value: token })
      continue
    }
    if (/^<!/i.test(token)) continue

    const closing = /^<\s*\//.test(token)
    const tagMatch = /^<\s*\/?\s*([a-z][\w:-]*)/i.exec(token)
    if (!tagMatch) continue
    const tag = (tagMatch[1] || '').toLowerCase()

    if (closing) {
      for (let index = stack.length - 1; index > 0; index--) {
        if (stack[index]?.tag !== tag) continue
        stack.length = index
        break
      }
      continue
    }

    const attrStart = tagMatch[0].length
    const attrEnd = token.length - (token.endsWith('>') ? 1 : 0)
    const attrSource = token.slice(attrStart, attrEnd).replace(/\/\s*$/, '')
    const element: ArticleHtmlElementNode = {
      kind: 'element',
      tag,
      attrs: parseArticleHtmlAttributes(attrSource),
      children: []
    }
    parent.children.push(element)

    if (!ARTICLE_VOID_HTML_TAGS.has(tag) && !/\/\s*>$/.test(token)) {
      stack.push(element)
    }
  }

  return root
}

const articleHtmlTextContent = (node: ArticleHtmlTreeNode, preserveWhitespace = false): string => {
  if (node.kind === 'text') return decodeArticleHtmlEntities(node.value)
  if (node.tag === 'br') return '\n'
  if (ARTICLE_IGNORED_HTML_TAGS.has(node.tag)) return ''
  const text = node.children.map(child => articleHtmlTextContent(child, preserveWhitespace)).join('')
  return preserveWhitespace ? text : text.replace(/[\t\r\n\f ]+/g, ' ')
}

const articleStyleEquals = (
  left: BilibiliArticleRichTextInlineStyle | undefined,
  right: BilibiliArticleRichTextInlineStyle | undefined
): boolean => JSON.stringify(left || {}) === JSON.stringify(right || {})

const mergeArticleInlineStyle = (
  inherited: BilibiliArticleRichTextInlineStyle | undefined,
  element: ArticleHtmlElementNode
): BilibiliArticleRichTextInlineStyle | undefined => {
  const style: BilibiliArticleRichTextInlineStyle = { ...(inherited || {}) }
  const tag = element.tag
  if (tag === 'b' || tag === 'strong') style.bold = true
  if (tag === 'i' || tag === 'em') style.italic = true
  if (tag === 's' || tag === 'strike' || tag === 'del') style.strike = true
  if (tag === 'a') {
    const link = normalizeArticleLinkUrl(element.attrs.href)
    if (link) style.link = link
  }
  if (tag === 'font' && element.attrs.color) style.color = element.attrs.color.trim()

  const declarations = String(element.attrs.style || '').split(';')
  for (const declaration of declarations) {
    const separator = declaration.indexOf(':')
    if (separator < 0) continue
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const value = declaration.slice(separator + 1).trim()
    if (!value) continue
    if (property === 'color') style.color = value
    if (property === 'font-size') style.fontSize = value
    if (property === 'font-style' && value.toLowerCase() === 'italic') style.italic = true
    if (property === 'font-weight' && (value.toLowerCase() === 'bold' || Number.parseInt(value, 10) >= 600)) {
      style.bold = true
    }
    if (property === 'text-decoration' && /line-through/i.test(value)) style.strike = true
  }

  return Object.keys(style).length > 0 ? style : undefined
}

const isArticleInlineRichTextNode = (node: BilibiliArticleRichTextNode): boolean => {
  switch (node.type) {
    case 'text':
    case 'emoji':
    case 'mention':
    case 'searchKeyword':
    case 'lineBreak':
    case 'topic':
    case 'at':
    case 'lottery':
    case 'webLink':
    case 'vote':
    case 'viewPicture':
    case 'hashtag':
      return true
    default:
      return false
  }
}

const pushArticleInlineNode = (
  target: BilibiliArticleRichTextNode[],
  node: BilibiliArticleRichTextNode
): void => {
  if (node.type === 'text' && !node.text) return
  const previous = target[target.length - 1]
  if (
    node.type === 'text' && previous?.type === 'text' &&
    articleStyleEquals(previous.style, node.style)
  ) {
    previous.text += node.text
    return
  }
  target.push(node)
}

const trimArticleInlineNodes = (
  source: BilibiliArticleRichTextNode[]
): BilibiliArticleRichTextNode[] => {
  const nodes = source.map(node => node.type === 'text'
    ? { ...node, style: node.style ? { ...node.style } : undefined }
    : node)

  const firstText = nodes.find(node => node.type === 'text')
  if (firstText?.type === 'text') firstText.text = firstText.text.replace(/^\s+/, '')
  const lastText = [...nodes].reverse().find(node => node.type === 'text')
  if (lastText?.type === 'text') lastText.text = lastText.text.replace(/\s+$/, '')

  return nodes.filter(node => node.type !== 'text' || Boolean(node.text))
}

const normalizeArticleHtmlInlineText = (value: string): string => decodeArticleHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/[\t\r\n\f ]+/g, ' ')

const articleImageFallbackText = (alt?: string, caption?: string): string => {
  const normalizedAlt = String(alt || '').trim()
  const normalizedCaption = String(caption || '').trim()
  if (normalizedAlt && normalizedCaption && normalizedAlt !== normalizedCaption) {
    return `${normalizedAlt}（${normalizedCaption}）`
  }
  return normalizedAlt || normalizedCaption || '专栏图片'
}

const getArticleHtmlImageData = (
  element: ArticleHtmlElementNode,
  caption?: string
): { src: string, alt: string, caption?: string } => {
  const src = normalizeArticleImageUrl(
    element.attrs.src || element.attrs['data-src'] ||
    element.attrs['data-original'] || element.attrs['data-url']
  )
  const alt = String(element.attrs.alt || '专栏图片').trim() || '专栏图片'
  const normalizedCaption = String(caption || element.attrs['data-caption'] || '').trim()
  return normalizedCaption ? { src, alt, caption: normalizedCaption } : { src, alt }
}

const findArticleHtmlElements = (
  node: ArticleHtmlTreeNode,
  predicate: (element: ArticleHtmlElementNode) => boolean,
  result: ArticleHtmlElementNode[] = []
): ArticleHtmlElementNode[] => {
  if (node.kind === 'text') return result
  if (predicate(node)) result.push(node)
  for (const child of node.children) findArticleHtmlElements(child, predicate, result)
  return result
}

const getArticleCodeLanguage = (element: ArticleHtmlElementNode): string | undefined => {
  const codeElement = findArticleHtmlElements(element, child => child.tag === 'code')[0]
  const attrs = codeElement?.attrs || element.attrs
  const className = String(attrs.class || '')
  const classMatch = /(?:^|\s)(?:language|lang)-([^\s]+)/i.exec(className)
  const language = String(
    classMatch?.[1] || attrs['data-language'] || attrs['data-lang'] || attrs.lang || ''
  ).trim()
  return language || undefined
}

const collectArticleInlineNodes = (
  node: ArticleHtmlTreeNode,
  inheritedStyle: BilibiliArticleRichTextInlineStyle | undefined,
  target: BilibiliArticleRichTextNode[]
): void => {
  if (node.kind === 'text') {
    const text = normalizeArticleHtmlInlineText(node.value)
    if (text) pushArticleInlineNode(target, articleTextNode(text, inheritedStyle))
    return
  }
  if (ARTICLE_IGNORED_HTML_TAGS.has(node.tag)) return
  if (node.tag === 'br') {
    target.push({ type: 'lineBreak' })
    return
  }
  if (node.tag === 'img') {
    const image = getArticleHtmlImageData(node)
    if (!image.src) pushArticleInlineNode(target, articleTextNode(articleImageFallbackText(image.alt), inheritedStyle))
    return
  }

  const style = mergeArticleInlineStyle(inheritedStyle, node)
  for (const child of node.children) collectArticleInlineNodes(child, style, target)
}

const collectArticleMixedNodes = (
  node: ArticleHtmlTreeNode,
  inheritedStyle: BilibiliArticleRichTextInlineStyle | undefined,
  target: BilibiliArticleRichTextNode[]
): void => {
  if (node.kind === 'text') {
    const text = normalizeArticleHtmlInlineText(node.value)
    if (text) pushArticleInlineNode(target, articleTextNode(text, inheritedStyle))
    return
  }
  if (ARTICLE_IGNORED_HTML_TAGS.has(node.tag)) return
  if (node.tag === 'br') {
    target.push({ type: 'lineBreak' })
    return
  }
  if (node.tag === 'img') {
    const image = getArticleHtmlImageData(node)
    if (image.src) {
      target.push({
        type: 'image',
        src: image.src,
        alt: image.alt,
        ...(image.caption ? { caption: image.caption } : {})
      })
    } else {
      pushArticleInlineNode(
        target,
        articleTextNode(articleImageFallbackText(image.alt, image.caption), inheritedStyle)
      )
    }
    return
  }
  if (node.tag === 'hr') {
    target.push({ type: 'horizontalRule' })
    return
  }
  if (node.tag === 'pre') {
    const content = articleHtmlTextContent(node, true)
    const language = getArticleCodeLanguage(node)
    if (content) target.push({ type: 'codeBlock', content, ...(language ? { language } : {}) })
    return
  }

  const style = mergeArticleInlineStyle(inheritedStyle, node)
  for (const child of node.children) collectArticleMixedNodes(child, style, target)
}

const articleMixedNodesToBlocks = (
  mixedNodes: BilibiliArticleRichTextNode[]
): BilibiliArticleRichTextNode[] => {
  const result: BilibiliArticleRichTextNode[] = []
  let inlineBuffer: BilibiliArticleRichTextNode[] = []

  const flushInline = () => {
    const nodes = trimArticleInlineNodes(inlineBuffer)
    inlineBuffer = []
    if (nodes.length > 0) result.push({ type: 'paragraph', nodes })
  }

  for (const node of mixedNodes) {
    if (isArticleInlineRichTextNode(node)) {
      pushArticleInlineNode(inlineBuffer, node)
    } else {
      flushInline()
      result.push(node)
    }
  }
  flushInline()
  return result
}

const isArticleHtmlBlockElement = (element: ArticleHtmlElementNode): boolean =>
  ARTICLE_BLOCK_HTML_TAGS.has(element.tag) ||
  /^h[1-6]$/.test(element.tag) ||
  element.tag === 'img' || element.tag === 'pre' || element.tag === 'li'

const convertArticleHtmlFlow = (
  children: ArticleHtmlTreeNode[]
): BilibiliArticleRichTextNode[] => {
  const result: BilibiliArticleRichTextNode[] = []
  let inlineBuffer: BilibiliArticleRichTextNode[] = []

  const flushInline = () => {
    const nodes = trimArticleInlineNodes(inlineBuffer)
    inlineBuffer = []
    if (nodes.length > 0) result.push({ type: 'paragraph', nodes })
  }

  const appendMixed = (mixed: BilibiliArticleRichTextNode[]) => {
    for (const node of mixed) {
      if (isArticleInlineRichTextNode(node)) {
        pushArticleInlineNode(inlineBuffer, node)
      } else {
        flushInline()
        result.push(node)
      }
    }
  }

  for (const child of children) {
    if (child.kind === 'element' && isArticleHtmlBlockElement(child)) {
      flushInline()
      result.push(...convertArticleHtmlElement(child))
      continue
    }
    const mixed: BilibiliArticleRichTextNode[] = []
    collectArticleMixedNodes(child, undefined, mixed)
    appendMixed(mixed)
  }
  flushInline()
  return result
}

const convertArticleHtmlList = (
  element: ArticleHtmlElementNode
): BilibiliArticleRichTextNode[] => {
  const listElements = element.children.filter((child): child is ArticleHtmlElementNode =>
    child.kind === 'element' && child.tag === 'li')
  const items: Array<Extract<BilibiliArticleRichTextNode, { type: 'listItem' }>> = []

  for (const listElement of listElements) {
    const blocks = convertArticleHtmlFlow(listElement.children)
    let itemNodes: BilibiliArticleRichTextNode[] = blocks
    const firstBlock = blocks[0]
    if (blocks.length === 1 && firstBlock?.type === 'paragraph') itemNodes = firstBlock.nodes
    if (itemNodes.length > 0) items.push({ type: 'listItem', nodes: itemNodes })
  }

  if (items.length === 0) {
    const inline: BilibiliArticleRichTextNode[] = []
    for (const child of element.children) collectArticleInlineNodes(child, undefined, inline)
    const nodes = trimArticleInlineNodes(inline)
    if (nodes.length > 0) items.push({ type: 'listItem', nodes })
  }

  return items.length > 0 ? [{ type: 'list', ordered: element.tag === 'ol', items }] : []
}

const convertArticleHtmlFigure = (
  element: ArticleHtmlElementNode
): BilibiliArticleRichTextNode[] => {
  const captionElement = findArticleHtmlElements(element, child => child.tag === 'figcaption')[0]
  const caption = captionElement
    ? articleHtmlTextContent(captionElement).replace(/[\t\r\n\f ]+/g, ' ').trim()
    : undefined
  const images = findArticleHtmlElements(element, child => child.tag === 'img')

  if (images.length === 0) {
    return convertArticleHtmlFlow(element.children)
  }

  const result: BilibiliArticleRichTextNode[] = []
  for (const imageElement of images) {
    const image = getArticleHtmlImageData(imageElement, caption)
    if (!image.src) {
      result.push({
        type: 'paragraph',
        nodes: [articleTextNode(articleImageFallbackText(image.alt, image.caption))]
      })
    } else {
      result.push({
        type: 'image',
        src: image.src,
        alt: image.alt,
        ...(image.caption ? { caption: image.caption } : {})
      })
    }
  }
  return result
}

const convertArticleHtmlElement = (
  element: ArticleHtmlElementNode
): BilibiliArticleRichTextNode[] => {
  const tag = element.tag
  if (ARTICLE_IGNORED_HTML_TAGS.has(tag)) return []

  if (/^h[1-6]$/.test(tag)) {
    const inline: BilibiliArticleRichTextNode[] = []
    for (const child of element.children) collectArticleInlineNodes(child, undefined, inline)
    const nodes = trimArticleInlineNodes(inline)
    if (nodes.length === 0) return []
    const level = Number.parseInt(tag.slice(1), 10) as 1 | 2 | 3 | 4 | 5 | 6
    return [{ type: 'heading', level, nodes }]
  }

  if (tag === 'p' || tag === 'figcaption') {
    const mixed: BilibiliArticleRichTextNode[] = []
    for (const child of element.children) collectArticleMixedNodes(child, undefined, mixed)
    return articleMixedNodesToBlocks(mixed)
  }

  if (tag === 'blockquote') {
    const blocks = convertArticleHtmlFlow(element.children)
    if (blocks.length === 0) return []
    const firstBlock = blocks[0]
    const children = blocks.length === 1 && firstBlock?.type === 'paragraph'
      ? firstBlock.nodes
      : blocks
    return [{ type: 'blockquote', nodes: children }]
  }

  if (tag === 'ul' || tag === 'ol') return convertArticleHtmlList(element)

  if (tag === 'pre') {
    const content = articleHtmlTextContent(element, true)
    if (!content) return []
    const language = getArticleCodeLanguage(element)
    return [{ type: 'codeBlock', content, ...(language ? { language } : {}) }]
  }

  if (tag === 'hr') return [{ type: 'horizontalRule' }]

  if (tag === 'img') {
    const image = getArticleHtmlImageData(element)
    if (!image.src) {
      return [{
        type: 'paragraph',
        nodes: [articleTextNode(articleImageFallbackText(image.alt, image.caption))]
      }]
    }
    return [{
      type: 'image',
      src: image.src,
      alt: image.alt,
      ...(image.caption ? { caption: image.caption } : {})
    }]
  }

  if (tag === 'figure') return convertArticleHtmlFigure(element)

  if (tag === 'li') {
    const blocks = convertArticleHtmlFlow(element.children)
    const firstBlock = blocks[0]
    const nodes = blocks.length === 1 && firstBlock?.type === 'paragraph'
      ? firstBlock.nodes
      : blocks
    return nodes.length > 0 ? [{ type: 'listItem', nodes }] : []
  }

  return convertArticleHtmlFlow(element.children)
}

/**
 * 将旧版 B 站专栏 HTML 尽力解析为宿主无关的富文本 JSON。
 * 不执行 HTML，也不依赖 DOM、Karin 或云崽消息段。
 */
export const parseHtmlContentToRichText = (
  content: string | undefined = ''
): BilibiliArticleRichTextDocument => {
  if (!String(content || '').trim()) return createBilibiliArticleDocument()
  const tree = parseArticleHtmlTree(String(content))
  return createBilibiliArticleDocument(convertArticleHtmlFlow(tree.children))
}

const opusTextStyle = (
  word: BilibiliArticleOpusWord,
  useDarkTheme: boolean
): BilibiliArticleRichTextInlineStyle | undefined => {
  const source = word.style || {}
  const style: BilibiliArticleRichTextInlineStyle = {}
  if (source.bold) style.bold = true
  if (source.italic) style.italic = true
  if (source.strike) style.strike = true
  if (typeof source.link === 'string' && source.link) style.link = normalizeArticleLinkUrl(source.link)

  const color = useDarkTheme ? word.dark_color : word.color
  if (!style.color && typeof color === 'string' && color) style.color = color
  if (typeof source.color === 'string' && source.color) style.color = source.color
  return Object.keys(style).length > 0 ? style : undefined
}

const opusWordLinesToNodes = (
  word: BilibiliArticleOpusWord,
  useDarkTheme: boolean
): BilibiliArticleRichTextNode[] => {
  const words = String(word.words || '')
  if (!words) return []
  const style = opusTextStyle(word, useDarkTheme)
  const result: BilibiliArticleRichTextNode[] = []
  for (const part of words.split(/(\r?\n)/)) {
    if (part === '\n' || part === '\r\n') result.push({ type: 'lineBreak' })
    else if (part) pushArticleInlineNode(result, articleTextNode(part, style))
  }
  return result
}

const isOrderedOpusList = (value: unknown): boolean => {
  if (typeof value === 'number') return value === 1
  const normalized = String(value || '').toLowerCase()
  return ['ordered', 'order', 'ol', 'number', 'numbered', 'decimal'].includes(normalized)
}

const opusHeadingLevel = (
  paragraphs: BilibiliArticleOpusTextNode[],
  headingType: unknown
): 1 | 2 | 3 | 4 | 5 | 6 => {
  const explicit = Number(headingType)
  if (Number.isInteger(explicit) && explicit >= 1 && explicit <= 6) return explicit as 1 | 2 | 3 | 4 | 5 | 6

  const header = paragraphs.find(node => typeof node.word?.style?.header === 'number')?.word?.style?.header
  if (typeof header === 'number' && header >= 1 && header <= 6) return header as 1 | 2 | 3 | 4 | 5 | 6

  const sizes = paragraphs
    .map(node => Number(node.word?.font_size))
    .filter(size => Number.isFinite(size) && size > 0)
  const maxSize = sizes.length > 0 ? Math.max(...sizes) : 0
  if (maxSize >= 26) return 1
  if (maxSize >= 22) return 2
  if (maxSize >= 20) return 3
  return 2
}

const opusParagraphFallbackText = (paragraph: BilibiliArticleOpusParagraph): string => {
  const card = paragraph.link_card?.card
  if (paragraph.para_type === 7) return card?.show_text || paragraph.link_card?.default_text || '链接卡片'
  return ''
}

/** 将 B 站 opus 段落结构转换为宿主无关富文本文档。 */
export const parseOpusToRichText = (
  opus: BilibiliArticleOpus | null | undefined,
  useDarkTheme = false
): BilibiliArticleRichTextDocument => {
  const paragraphs = opus?.content?.paragraphs
  if (!Array.isArray(paragraphs)) return createBilibiliArticleDocument()

  const result: BilibiliArticleRichTextNode[] = []
  let listBuffer: {
    ordered: boolean
    items: Array<Extract<BilibiliArticleRichTextNode, { type: 'listItem' }>>
  } | undefined

  const flushList = () => {
    if (!listBuffer) return
    if (listBuffer.items.length > 0) {
      result.push({ type: 'list', ordered: listBuffer.ordered, items: listBuffer.items })
    }
    listBuffer = undefined
  }

  for (const paragraph of paragraphs) {
    const paraType = Number(paragraph?.para_type)

    if (paraType === 2) {
      flushList()
      const pictures = paragraph.pic?.pics
      if (!Array.isArray(pictures) || pictures.length === 0) continue
      for (const picture of pictures) {
        const src = normalizeArticleImageUrl(picture?.url)
        const alt = String(picture?.alt || '专栏图片').trim() || '专栏图片'
        const caption = String(picture?.comment || '').trim()
        if (src) {
          result.push({
            type: 'image',
            src,
            alt,
            ...(caption ? { caption } : {})
          })
        } else {
          result.push({
            type: 'paragraph',
            nodes: [articleTextNode(articleImageFallbackText(alt, caption))]
          })
        }
      }
      continue
    }

    if (paraType === 3) {
      flushList()
      result.push({ type: 'horizontalRule' })
      continue
    }

    if (paraType === 7) {
      flushList()
      const card = paragraph.link_card?.card
      const url = normalizeArticleLinkUrl(card?.link)
      if (url) {
        const title = card?.show_text || paragraph.link_card?.default_text || '链接卡片'
        result.push({
          type: 'linkCard',
          title,
          url,
          ...(card?.link_type !== undefined ? { cardType: String(card.link_type) } : {}),
          meta: { bizId: card?.biz_id, contentCard: card?.content_card }
        })
      } else {
        const fallback = opusParagraphFallbackText(paragraph)
        if (fallback) result.push({ type: 'paragraph', nodes: [articleTextNode(fallback)] })
      }
      continue
    }

    if (paraType === 8) {
      flushList()
      const content = paragraph.code?.content
      if (typeof content === 'string' && content.length > 0) {
        const language = String(paragraph.code?.lang || '').trim()
        result.push({ type: 'codeBlock', content, ...(language ? { language } : {}) })
      }
      continue
    }

    const textNodes = Array.isArray(paragraph.text?.nodes) ? paragraph.text.nodes : []
    const inlineNodes = textNodes.flatMap(node => {
      if (node?.node_type !== undefined && node.node_type !== 1) return []
      return node?.word ? opusWordLinesToNodes(node.word, useDarkTheme) : []
    })
    if (inlineNodes.length === 0) {
      flushList()
      continue
    }

    const headingType = paragraph.format?.heading_type
    const hasHeadingStyle = textNodes.some(node => Boolean(node.word?.style?.header))
    const hasLargeFont = textNodes.some(node => {
      const size = Number(node.word?.font_size)
      return Number.isFinite(size) && size >= 20
    })
    const levelValue = String(textNodes.find(node => node.word?.font_level)?.word?.font_level || '')
    const isHeading = paraType === 9 ||
      (typeof headingType === 'number' && headingType >= 1 && headingType <= 6) ||
      hasHeadingStyle || hasLargeFont || /^(?:xlarge|large)$/i.test(levelValue)
    const listStyle = textNodes.find(node => node.word?.style?.list)?.word?.style?.list
    const hasList = listStyle !== undefined && listStyle !== null && listStyle !== false && listStyle !== ''

    if (isHeading) {
      flushList()
      result.push({
        type: 'heading',
        level: opusHeadingLevel(textNodes, headingType),
        nodes: inlineNodes
      })
      continue
    }

    if (paraType === 4) {
      flushList()
      result.push({ type: 'blockquote', nodes: inlineNodes })
      continue
    }

    if (hasList) {
      const ordered = isOrderedOpusList(listStyle)
      if (!listBuffer || listBuffer.ordered !== ordered) {
        flushList()
        listBuffer = { ordered, items: [] }
      }
      listBuffer.items.push({ type: 'listItem', nodes: inlineNodes })
      continue
    }

    flushList()
    result.push({ type: 'paragraph', nodes: inlineNodes })
  }

  flushList()
  return createBilibiliArticleDocument(result)
}

/**
 * opus 存在 paragraphs（包括空数组）时优先使用 opus；否则回退到旧版 HTML。
 */
export const buildBilibiliArticleRichText = (
  opus: BilibiliArticleOpus | null | undefined,
  content?: string,
  useDarkTheme = false
): BilibiliArticleRichTextDocument => {
  if (Array.isArray(opus?.content?.paragraphs)) return parseOpusToRichText(opus, useDarkTheme)
  return parseHtmlContentToRichText(content)
}

const MAX_BILIBILI_FORWARD_TEXT_LENGTH = 1800

const normalizeBilibiliForwardText = (text: string): string => text
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

/** 按消息文本上限拆分，同时尽量在段落/换行边界切分并保留所有字符。 */
export const splitBilibiliRichText = (
  text: string,
  limit = MAX_BILIBILI_FORWARD_TEXT_LENGTH
): string[] => {
  if (!text) return []
  const safeLimit = Number.isFinite(limit) && limit > 0
    ? Math.max(1, Math.floor(limit))
    : MAX_BILIBILI_FORWARD_TEXT_LENGTH
  const chunks: string[] = []
  let rest = text

  while (rest.length > safeLimit) {
    let splitAt = -1
    const blankLine = rest.lastIndexOf('\n\n', safeLimit)
    if (blankLine >= 0 && blankLine + 2 <= safeLimit) splitAt = blankLine + 2
    if (splitAt < Math.floor(safeLimit / 2)) {
      const newline = rest.lastIndexOf('\n', safeLimit - 1)
      if (newline >= Math.floor(safeLimit / 2)) splitAt = newline + 1
    }
    if (splitAt < Math.floor(safeLimit / 2)) {
      const whitespace = Math.max(
        rest.lastIndexOf(' ', safeLimit - 1),
        rest.lastIndexOf('\t', safeLimit - 1)
      )
      if (whitespace >= Math.floor(safeLimit / 2)) splitAt = whitespace + 1
    }
    if (splitAt <= 0 || splitAt > safeLimit) splitAt = safeLimit

    // 尽量不把 UTF-16 surrogate pair 拆开。
    const previousCodeUnit = rest.charCodeAt(splitAt - 1)
    const nextCodeUnit = rest.charCodeAt(splitAt)
    if (
      splitAt > 1 && splitAt < rest.length &&
      previousCodeUnit >= 0xD800 && previousCodeUnit <= 0xDBFF &&
      nextCodeUnit >= 0xDC00 && nextCodeUnit <= 0xDFFF
    ) splitAt -= 1

    chunks.push(rest.slice(0, splitAt))
    rest = rest.slice(splitAt)
  }
  if (rest) chunks.push(rest)
  return chunks
}

const formatBilibiliForwardLink = (text: string, url?: string): string => {
  if (!url || url === text) return text
  return `${text} (${url})`
}

const bilibiliInlineNodeToForwardText = (
  node: BilibiliArticleRichTextNode
): string => {
  switch (node.type) {
    case 'text':
      return node.style?.link ? formatBilibiliForwardLink(node.text, node.style.link) : node.text
    case 'mention':
    case 'searchKeyword':
    case 'topic':
    case 'at':
    case 'lottery':
    case 'vote':
    case 'viewPicture':
    case 'hashtag':
      return node.text
    case 'emoji':
      return node.name
    case 'webLink':
      return formatBilibiliForwardLink(node.text, node.jumpUrl)
    case 'lineBreak':
      return '\n'
    default:
      return ''
  }
}

/**
 * 将富文本文档转换为不绑定宿主的 text/image 节点。
 * 图片解析失败时会把 alt/caption 放回文本，并继续处理后续节点。
 */
export const buildBilibiliRichTextForwardNodes = async (
  document: BilibiliArticleRichTextDocument,
  options: BilibiliRichTextForwardOptions = {}
): Promise<BilibiliRichTextForwardNode[]> => {
  const result: BilibiliRichTextForwardNode[] = []
  let textBuffer = ''
  let imageIndex = 0
  const maxTextLength = Number.isFinite(options.maxTextLength) && (options.maxTextLength || 0) > 0
    ? Math.max(1, Math.floor(options.maxTextLength as number))
    : MAX_BILIBILI_FORWARD_TEXT_LENGTH

  const appendText = (text: string) => {
    if (text) textBuffer += text
  }

  const ensureBlockBreak = () => {
    if (!textBuffer || textBuffer.endsWith('\n\n')) return
    textBuffer += textBuffer.endsWith('\n') ? '\n' : '\n\n'
  }

  const flushText = () => {
    const text = normalizeBilibiliForwardText(textBuffer)
    textBuffer = ''
    for (const chunk of splitBilibiliRichText(text, maxTextLength)) result.push({ type: 'text', text: chunk })
  }

  const appendChildren = async (nodes: BilibiliArticleRichTextNode[]): Promise<void> => {
    for (const node of nodes) await appendNode(node)
  }

  const appendImage = async (
    node: Extract<BilibiliArticleRichTextNode, { type: 'image' }>
  ): Promise<void> => {
    flushText()
    const index = imageIndex++
    let resolved: string | null = node.src || null
    let failed = !resolved
    if (resolved && options.imageResolver) {
      try {
        const candidate = await options.imageResolver(resolved, index)
        if (typeof candidate === 'string' && candidate.trim()) resolved = candidate
        else {
          resolved = null
          failed = true
        }
      } catch {
        resolved = null
        failed = true
      }
    }

    if (!failed && resolved) {
      result.push({
        type: 'image',
        src: resolved,
        ...(node.alt !== undefined ? { alt: node.alt } : {}),
        ...(node.caption !== undefined ? { caption: node.caption } : {})
      })
      if (node.caption) {
        appendText(node.caption)
        ensureBlockBreak()
      }
      return
    }

    appendText(articleImageFallbackText(node.alt, node.caption))
    ensureBlockBreak()
  }

  const appendNode = async (node: BilibiliArticleRichTextNode): Promise<void> => {
    const inlineText = bilibiliInlineNodeToForwardText(node)
    if (inlineText) {
      appendText(inlineText)
      return
    }

    switch (node.type) {
      case 'heading':
      case 'paragraph':
      case 'blockquote':
      case 'listItem':
        ensureBlockBreak()
        await appendChildren(node.nodes)
        ensureBlockBreak()
        return
      case 'image':
        await appendImage(node)
        return
      case 'list':
        ensureBlockBreak()
        for (const [index, item] of node.items.entries()) {
          appendText(node.ordered ? `${index + 1}. ` : '- ')
          await appendChildren(item.nodes)
          appendText('\n')
        }
        ensureBlockBreak()
        return
      case 'codeBlock':
        ensureBlockBreak()
        appendText(node.content)
        ensureBlockBreak()
        return
      case 'linkCard':
        ensureBlockBreak()
        appendText(formatBilibiliForwardLink(node.title, node.url))
        ensureBlockBreak()
        return
      case 'horizontalRule':
        ensureBlockBreak()
        appendText('---')
        ensureBlockBreak()
        break
    }
  }

  const headers: string[] = []
  if (options.title) headers.push(`标题：${options.title}`)
  if (options.summary) headers.push(`简介：${options.summary}`)
  if (options.shareUrl) headers.push(`链接：${options.shareUrl}`)
  if (headers.length > 0) {
    appendText(headers.join('\n'))
    ensureBlockBreak()
  }

  await appendChildren(Array.isArray(document?.nodes) ? document.nodes : [])
  flushText()
  return result
}
