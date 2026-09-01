/**
 * `src/` 与 `ktr/` 共用的模板载荷类型，唯一声明处。
 *
 * 为什么声明留在 `src/` 而不是模板树里：`tsconfig.json` 的 `rootDir` 是 `./src`，从 `src/`
 * import `ktr/**` 的 .ts 会直接 TS6059，所以能共享的方向只有「声明放进 rootDir 内、模板侧
 * 反过来引它」，与 9d215bd 给 richtext 定的路子一致。两侧都写
 * `@/module/utils/template-contracts`：四个 program 的 `@/*` 都指向 `./src/*`，
 * 同一个类型不会出现第二条合法导入路径。
 *
 * 本目录必须零运行时 import。它会被 ktr 的 vite 构建顺着 `import type` 看到，而那边只配了
 * `@kkk/richtext` 一个别名，没有 `@/`；全是类型时 esbuild 把整条 import 擦掉，说明符根本
 * 到不了 resolver。一旦引入值导出，模板构建会立刻解析失败。
 */
import type { RichTextDocument } from '@kkk/richtext'

/**
 * 装饰卡片数据
 */
export interface DecorationCardData {
  /** 卡片背景图片URL */
  card_url: string
  /** 渐变颜色数组 */
  colors: string[]
  /** 卡片显示文字 */
  text: string
}

/** 评论中的搜索词扩展 */
export interface ExtraSearchText {
  /** 搜索文本内容 */
  search_text: string
  /** 搜索查询ID */
  search_query_id: string
}

/** 评论正文 `text_extra` 的原始项，模板侧只透传 */
export interface RawTextExtra {
  start?: number
  end?: number
  sec_uid?: string
  search_text?: string
  search_query_id?: string
}

/** 渲染用的评论项，也就是 `douyin/comment` 模板 `CommentsData` 的元素 */
export interface DouyinComment {
  /** 楼层序号，从 1 开始 */
  id?: number
  /** 评论 CID */
  cid?: string
  /** 作品 ID */
  aweme_id?: string
  /** 用户头像 URL */
  userimageurl: string
  /** 用户昵称 */
  nickname: string
  /** 标签类型（1 = 作者） */
  label_type?: number
  /** 状态标签 */
  status_label?: string
  /** 评论正文富文本 */
  text: RichTextDocument
  /** 评论图片 */
  commentimage?: string
  /** 贴纸 */
  sticker?: string
  /** 创建时间戳（秒） */
  create_time: number
  /** IP 标签 */
  ip_label: string
  /** 点赞数 */
  digg_count: number
  /** 搜索词 */
  search_text?: ExtraSearchText[] | null
  /** 正文里 @ 到的用户 sec_uid 列表 */
  is_At_user_id?: string[] | null
  /** 子评论 */
  replyComment?: DouyinSubComment[]
  /** 作者是否点赞过这条评论 */
  is_author_digged?: boolean
}

/** 渲染用的子评论项 */
export interface DouyinSubComment {
  /** 创建时间戳（秒） */
  create_time: number
  /** 用户昵称 */
  nickname: string
  /** 用户头像 URL */
  userimageurl: string
  /** 评论正文富文本 */
  text: RichTextDocument
  /** 点赞数 */
  digg_count: number
  /** IP 标签 */
  ip_label: string
  /** 原始 text_extra，模板侧目前只透传 */
  text_extra: RawTextExtra[]
  /** 标签文本 */
  label_text: string
  /** 评论图片 */
  image_list: string[] | null
  /** 评论 CID */
  cid: string
  /** 回复的评论 ID */
  reply_to_reply_id: string
  /** 回复的用户昵称 */
  reply_to_username: string
}
