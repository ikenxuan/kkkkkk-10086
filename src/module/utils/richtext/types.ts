/**
 * 富文本节点联合类型。
 *
 * 后端只需要生产这些纯 JSON 节点，前端可以再按 React、HTML、Canvas 等不同目标渲染。
 */
export type RichTextNode = RichTextInlineNode | RichTextBlockNode

/** 行内节点。 */
export type RichTextInlineNode =
  | RichTextTextNode
  | RichTextEmojiNode
  | RichTextMentionNode
  | RichTextSearchKeywordNode
  | RichTextLineBreakNode
  | RichTextTopicNode
  | RichTextAtNode
  | RichTextLotteryNode
  | RichTextWebLinkNode
  | RichTextVoteNode
  | RichTextViewPictureNode
  | RichTextHashtagNode

/** 块级节点。 */
export type RichTextBlockNode =
  | RichTextHeadingNode
  | RichTextParagraphNode
  | RichTextImageNode
  | RichTextBlockquoteNode
  | RichTextListNode
  | RichTextListItemNode
  | RichTextCodeBlockNode
  | RichTextLinkCardNode
  | RichTextHorizontalRuleNode

/**
 * 富文本文档。
 *
 * `version` 用来给后续节点协议升级留空间；`platform` 用来标记来源平台，方便后续按平台做兼容。
 */
export interface RichTextDocument {
  version: 1
  platform?: string
  nodes: RichTextNode[]
}

/** 行内文本样式。 */
export interface RichTextInlineStyle {
  /** 粗体 */
  bold?: boolean
  /** 斜体 */
  italic?: boolean
  /** 删除线 */
  strike?: boolean
  /** 文字颜色（CSS color 值） */
  color?: string
  /** 超链接地址 */
  link?: string
  /** 字体大小（CSS font-size 值） */
  fontSize?: string
}

/** 普通文本节点。文本永远作为文本渲染，不会当成 HTML 执行。 */
export interface RichTextTextNode {
  type: 'text'
  /** 文本内容 */
  text: string
  /** 可选的行内样式 */
  style?: RichTextInlineStyle
}

/** 行内表情节点。用于评论文本中夹杂的平台表情图片。 */
export interface RichTextEmojiNode {
  type: 'emoji'
  /** 表情包名称 */
  name: string
  /** 表情包链接 */
  src: string
  /** 缩放倍率。默认 1，某些平台的大表情可以传 3。 */
  scale?: number
}

/** @ 用户节点。`userId` 可选，因为有些平台只给历史昵称，不给稳定 ID。 */
export interface RichTextMentionNode {
  type: 'mention'
  /** @ 用户的文本 */
  text: string
  /** UID */
  userId?: string
}

/**
 * 搜索词高亮节点。
 *
 * 某些平台会把"评论里的高亮搜索词"独立放在元数据里，而不是单独拼进 HTML。
 * 这里把它提升成独立节点，方便 template 渲染成高亮文本和上标搜索图标。
 */
export interface RichTextSearchKeywordNode {
  type: 'searchKeyword'
  /** 搜索词 */
  text: string
  /** 搜索ID */
  queryId?: string
}

/** 换行节点。前端渲染成 `<br />`，避免后端直接拼 HTML。 */
export interface RichTextLineBreakNode {
  type: 'lineBreak'
}

/** 话题节点。B站动态中以 #话题名称# 形式呈现，带彩色文字。 */
export interface RichTextTopicNode {
  type: 'topic'
  /** 话题名称（不含#号） */
  text: string
}

/** @用户节点。用于动态描述中的@提及。 */
export interface RichTextAtNode {
  type: 'at'
  /** @用户的显示文本 */
  text: string
  /** 用户ID（可选） */
  userId?: string
}

/** 抽奖节点。带SVG图标，显示抽奖信息。 */
export interface RichTextLotteryNode {
  type: 'lottery'
  /** 显示文本 */
  text: string
}

/** 网页链接节点。带SVG图标，显示链接的标题。 */
export interface RichTextWebLinkNode {
  type: 'webLink'
  /** 显示文本（如网页标题） */
  text: string
  /** 跳转链接 */
  jumpUrl: string
}

/** 投票节点。带SVG图标，显示投票标题。 */
export interface RichTextVoteNode {
  type: 'vote'
  /** 投票标题 */
  text: string
}

/** 查看图片节点。带SVG图标，提示用户点击查看图片。 */
export interface RichTextViewPictureNode {
  type: 'viewPicture'
  /** 显示文本 */
  text: string
}

/**
 * Hashtag 话题节点。
 *
 * 纯文本高亮，不带任何图标。用于抖音等平台的 #话题# 标签展示。
 * 与 topic 节点的区别：topic 带有 B站风格的 # 图标，hashtag 只做纯文字高亮。
 */
export interface RichTextHashtagNode {
  type: 'hashtag'
  /** 话题文本（包含 # 号） */
  text: string
}

/** 标题节点。 */
export interface RichTextHeadingNode {
  type: 'heading'
  /** 标题级别 1-6 */
  level: 1 | 2 | 3 | 4 | 5 | 6
  /** 子节点 */
  nodes: RichTextNode[]
}

/** 段落节点。 */
export interface RichTextParagraphNode {
  type: 'paragraph'
  /** 子节点 */
  nodes: RichTextNode[]
}

/** 图片节点。 */
export interface RichTextImageNode {
  type: 'image'
  /** 图片地址 */
  src: string
  /** 替代文本 */
  alt?: string
  /** 图片下方注释/说明文字 */
  caption?: string
}

/** 水平分隔线节点。 */
export interface RichTextHorizontalRuleNode {
  type: 'horizontalRule'
}

/** 引用块节点。 */
export interface RichTextBlockquoteNode {
  type: 'blockquote'
  /** 子节点 */
  nodes: RichTextNode[]
}

/** 列表节点。 */
export interface RichTextListNode {
  type: 'list'
  /** 是否为有序列表 */
  ordered: boolean
  /** 列表项 */
  items: RichTextListItemNode[]
}

/** 列表项节点。 */
export interface RichTextListItemNode {
  type: 'listItem'
  /** 子节点 */
  nodes: RichTextNode[]
}

/** 代码块节点。 */
export interface RichTextCodeBlockNode {
  type: 'codeBlock'
  /** 代码语言 */
  language?: string
  /** 代码内容 */
  content: string
}

/** 链接卡片节点。 */
export interface RichTextLinkCardNode {
  type: 'linkCard'
  /** 卡片标题/显示文本 */
  title: string
  /** 跳转链接 */
  url: string
  /** 卡片类型标识 */
  cardType?: string
  /** 额外元数据 */
  meta?: Record<string, any>
}

/** 平台表情定义，通常由 core 从平台表情接口转换得到。 */
export interface RichTextEmojiDefinition {
  name: string
  url: string
  /** 缩放倍率。默认 1。 */
  scale?: number
}

/**
 * 单个富文本节点的样式配置。
 *
 * 平台模板传入它们想要的 className，渲染器直接应用。
 * 只允许 className，不允许 style 对象——视觉样式全部由 Tailwind 接管。
 */
export interface RichTextNodeStyleConfig {
  /** Tailwind className，控制该节点的视觉样式 */
  className?: string
}

/**
 * 搜索关键词节点需要额外的图标 className（普通节点不需要）。
 */
export interface RichTextSearchKeywordStyleConfig extends RichTextNodeStyleConfig {
  /** 搜索图标的额外 className */
  iconClassName?: string
}

/**
 * HTML 渲染器配置。React 渲染器复用这些 className 约定。
 *
 * 传入的 className 会覆盖渲染器内部对这些节点的默认样式。
 * 视觉样式全部由 Tailwind className 表达，渲染器只负责结构。
 */
export interface RichTextRenderOptions {
  /** @提及节点 */
  mention?: RichTextNodeStyleConfig
  /** 搜索关键词节点（高亮词） */
  searchKeyword?: RichTextSearchKeywordStyleConfig
  /** 话题节点 */
  topic?: RichTextNodeStyleConfig
  /** @用户节点 */
  at?: RichTextNodeStyleConfig
  /** 抽奖节点 */
  lottery?: RichTextNodeStyleConfig
  /** 网页链接节点 */
  webLink?: RichTextNodeStyleConfig
  /** 投票节点 */
  vote?: RichTextNodeStyleConfig
  /** 查看图片节点 */
  viewPicture?: RichTextNodeStyleConfig
  /** 代码块节点 */
  codeBlock?: RichTextNodeStyleConfig
  /** 链接卡片节点 */
  linkCard?: RichTextNodeStyleConfig
  /** hashtag 话题节点 */
  hashtag?: RichTextNodeStyleConfig
  /** 图标缩放比例，默认 1。用于在不同字体大小下保持图标比例一致。 */
  iconScale?: number
}
