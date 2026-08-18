import type {
  RichTextBlockquoteNode,
  RichTextCodeBlockNode,
  RichTextDocument,
  RichTextEmojiNode,
  RichTextHashtagNode,
  RichTextHeadingNode,
  RichTextImageNode,
  RichTextLineBreakNode,
  RichTextLinkCardNode,
  RichTextListItemNode,
  RichTextListNode,
  RichTextMentionNode,
  RichTextNode,
  RichTextParagraphNode,
  RichTextSearchKeywordNode,
  RichTextTextNode,
  RichTextTopicNode,
  RichTextAtNode,
  RichTextLotteryNode,
  RichTextWebLinkNode,
  RichTextVoteNode,
  RichTextViewPictureNode,
  RichTextHorizontalRuleNode,
  RichTextInlineStyle
} from '../types'

/** 创建普通文本节点。 */
export const createTextNode = (text: string, style?: RichTextInlineStyle): RichTextTextNode => ({
  type: 'text',
  text,
  style
})

/** 创建行内表情节点。 */
export const createEmojiNode = (
  name: string,
  src: string,
  options: {
    scale?: number
  } = {}
): RichTextEmojiNode => ({
  type: 'emoji',
  name,
  src,
  scale: options.scale
})

/** 创建 @ 用户节点。 */
export const createMentionNode = (text: string, userId?: string): RichTextMentionNode => ({
  type: 'mention',
  text,
  userId
})

/** 创建搜索词高亮节点。 */
export const createSearchKeywordNode = (text: string, queryId?: string): RichTextSearchKeywordNode => ({
  type: 'searchKeyword',
  text,
  queryId
})

/** 创建换行节点。 */
export const createLineBreakNode = (): RichTextLineBreakNode => ({
  type: 'lineBreak'
})

/** 创建话题节点。 */
export const createTopicNode = (text: string): RichTextTopicNode => ({
  type: 'topic',
  text
})

/** 创建 @ 用户节点。 */
export const createAtNode = (text: string, userId?: string): RichTextAtNode => ({
  type: 'at',
  text,
  userId
})

/** 创建抽奖节点。 */
export const createLotteryNode = (text: string): RichTextLotteryNode => ({
  type: 'lottery',
  text
})

/** 创建网页链接节点。 */
export const createWebLinkNode = (text: string, jumpUrl: string): RichTextWebLinkNode => ({
  type: 'webLink',
  text,
  jumpUrl
})

/** 创建投票节点。 */
export const createVoteNode = (text: string): RichTextVoteNode => ({
  type: 'vote',
  text
})

/** 创建查看图片节点。 */
export const createViewPictureNode = (text: string): RichTextViewPictureNode => ({
  type: 'viewPicture',
  text
})

/** 创建标题节点。 */
export const createHeadingNode = (level: 1 | 2 | 3 | 4 | 5 | 6, nodes: RichTextNode[]): RichTextHeadingNode => ({
  type: 'heading',
  level,
  nodes
})

/** 创建段落节点。 */
export const createParagraphNode = (nodes: RichTextNode[]): RichTextParagraphNode => ({
  type: 'paragraph',
  nodes
})

/** 创建图片节点。 */
export const createImageNode = (src: string, alt?: string, caption?: string): RichTextImageNode => ({
  type: 'image',
  src,
  alt,
  caption
})

/** 创建水平分隔线节点。 */
export const createHorizontalRuleNode = (): RichTextHorizontalRuleNode => ({
  type: 'horizontalRule'
})

/** 创建引用块节点。 */
export const createBlockquoteNode = (nodes: RichTextNode[]): RichTextBlockquoteNode => ({
  type: 'blockquote',
  nodes
})

/** 创建列表节点。 */
export const createListNode = (ordered: boolean, items: RichTextListItemNode[]): RichTextListNode => ({
  type: 'list',
  ordered,
  items
})

/** 创建列表项节点。 */
export const createListItemNode = (nodes: RichTextNode[]): RichTextListItemNode => ({
  type: 'listItem',
  nodes
})

/** 创建代码块节点。 */
export const createCodeBlockNode = (content: string, language?: string): RichTextCodeBlockNode => ({
  type: 'codeBlock',
  content,
  language
})

/** 创建链接卡片节点。 */
export const createLinkCardNode = (
  title: string,
  url: string,
  options: { cardType?: string; meta?: Record<string, any> } = {}
): RichTextLinkCardNode => ({
  type: 'linkCard',
  title,
  url,
  cardType: options.cardType,
  meta: options.meta
})

/**
 * 创建 hashtag 节点。
 *
 * 纯文本高亮，不带任何图标。适用于抖音等平台的 #话题# 展示。
 */
export const createHashtagNode = (text: string): RichTextHashtagNode => ({
  type: 'hashtag',
  text
})

/**
 * 合并相邻文本节点并丢弃空文本节点。
 *
 * 这样 core 可以按匹配过程简单 push 节点，最后统一整理，避免前端拿到碎片过多的数据。
 */
export const normalizeRichTextNodes = (nodes: RichTextNode[]): RichTextNode[] => {
  const normalized: RichTextNode[] = []

  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.text.length === 0) {
        continue
      }

      const previousNode = normalized[normalized.length - 1]
      if (previousNode?.type === 'text') {
        previousNode.text += node.text
        continue
      }
    }

    normalized.push(node)
  }

  return normalized
}

/**
 * 从富文本文档中提取纯文本内容。
 *
 * 遍历所有节点，收集包含 text 字段的文本内容。
 * lineBreak 节点映射为空格（不参与长度计数），图片节点被忽略。
 */
export const extractRichTextPlainText = (document: RichTextDocument): string => {
  const extractFromNode = (node: RichTextNode): string => {
    switch (node.type) {
      case 'text':
      case 'mention':
      case 'searchKeyword':
      case 'topic':
      case 'at':
      case 'lottery':
      case 'webLink':
      case 'vote':
      case 'viewPicture':
      case 'hashtag':
      case 'emoji':
        return 'text' in node ? ((node as any).text ?? '') : ((node as any).name ?? '')
      case 'heading':
      case 'paragraph':
      case 'blockquote':
      case 'listItem':
        return node.nodes.map(extractFromNode).join('')
      case 'list':
        return node.items.map(extractFromNode).join('')
      case 'lineBreak':
      case 'horizontalRule':
        return ''
      case 'image':
        return ''
      case 'codeBlock':
        return node.content
      case 'linkCard':
        return node.title
      default:
        return ''
    }
  }

  return document.nodes.map(extractFromNode).join('')
}

/**
 * 创建富文本文档。
 *
 * 这里不会生成任何 HTML，只返回可序列化 JSON，适合作为 core 到 template 的数据边界。
 */
export const createRichTextDocument = (nodes: RichTextNode[], options: { platform?: string } = {}): RichTextDocument => ({
  version: 1,
  platform: options.platform,
  nodes: normalizeRichTextNodes(nodes)
})
