import type {
  RichTextDocument,
  RichTextEmojiNode,
  RichTextHashtagNode,
  RichTextLineBreakNode,
  RichTextMentionNode,
  RichTextNode,
  RichTextSearchKeywordNode,
  RichTextTextNode,
  RichTextTopicNode,
  RichTextAtNode,
  RichTextLotteryNode,
  RichTextWebLinkNode,
  RichTextOpusLinkNode,
  RichTextVoteNode,
  RichTextViewPictureNode,
  RichTextInlineStyle
// 走 "@/" 别名而不是 '../types.js'：src/ 的 lint 禁止跳出当前目录的相对导入。
// 这里能这么写的前提是它必须保持 type-only —— 本目录同时被 ktr 的 vite 构建
// （经 ktr/richtext/index.ts 这个 barrel）拉进去，而 karin.template.ts 里只配了
// @kkk/richtext 一个别名，没有 "@/"。type-only 导入会被 esbuild 整条擦掉，
// 说明符根本到不了 vite 的 resolver；一旦改成值导入，模板构建会立刻解析失败。
} from '@/module/utils/richtext/types'

export const createTextNode = (text: string, style?: RichTextInlineStyle): RichTextTextNode => ({
  type: 'text',
  text,
  style
})

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

export const createMentionNode = (text: string, userId?: string): RichTextMentionNode => ({
  type: 'mention',
  text,
  userId
})

export const createSearchKeywordNode = (text: string, queryId?: string): RichTextSearchKeywordNode => ({
  type: 'searchKeyword',
  text,
  queryId
})

export const createLineBreakNode = (): RichTextLineBreakNode => ({
  type: 'lineBreak'
})

export const createTopicNode = (text: string): RichTextTopicNode => ({
  type: 'topic',
  text
})

export const createAtNode = (text: string, userId?: string): RichTextAtNode => ({
  type: 'at',
  text,
  userId
})

export const createLotteryNode = (text: string): RichTextLotteryNode => ({
  type: 'lottery',
  text
})

export const createWebLinkNode = (text: string, jumpUrl: string): RichTextWebLinkNode => ({
  type: 'webLink',
  text,
  jumpUrl
})

export const createOpusLinkNode = (text: string, url: string): RichTextOpusLinkNode => ({
  type: 'opusLink',
  text,
  url
})

export const createVoteNode = (text: string): RichTextVoteNode => ({
  type: 'vote',
  text
})

export const createViewPictureNode = (text: string): RichTextViewPictureNode => ({
  type: 'viewPicture',
  text
})

/*
 * 这里原来还有 9 个 block 级节点的构造函数（heading / paragraph / image /
 * horizontalRule / blockquote / list / listItem / codeBlock / linkCard），
 * 全部零引用，已删。
 *
 * 别照着上面的 inline 构造函数把它们补回来：block 节点唯一的生产者是
 * `platform/bilibili/dynamicText.ts`，它按对象字面量直接造（`{ type: 'heading', ... }`），
 * 因为那边是从 B 站专栏的 HTML 树递归转换、需要在一处同时决定 type 和字段。
 * 渲染侧（ktr/richtext/react）按 `node.type` 判别，不依赖谁构造的。
 * inline 那批构造函数是活的，被 dynamicText 的行内解析和其他平台共用。
 */

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
 * lineBreak 节点映射为空字符串（不参与长度计数），图片节点被忽略。
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
      case 'opusLink':
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
