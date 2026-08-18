/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * 文章图片信息
 */
export interface ArticleImage {
  /** AI高清图片URL */
  ai_high_image_url: string
  /** 高清图片URL */
  high_image_url: string
  /** Markdown图片URL */
  markdown_url: string
  /** 原始图片URL */
  origin_image_url: string
}

/**
 * 抖音文章作品组件属性接口
 */
export interface DouyinArticleWorkData {
  /** 文章标题 */
  title: string
  /** 文章Markdown内容 */
  markdown: string
  /** 文章图片列表 */
  images: ArticleImage[]
  /** 阅读时间(分钟) */
  read_time: number
  /** 点赞数 */
  dianzan: string
  /** 评论数 */
  pinglun: string
  /** 收藏数 */
  shouchang: string
  /** 分享数 */
  share: string
  /** 创建时间 */
  create_time: string
  /** 用户头像URL */
  avater_url: string
  /** 用户名 */
  username: string
  /** 抖音号 */
  抖音号: string
  /** 获赞数 */
  获赞: string
  /** 关注数 */
  关注: string
  /** 粉丝数 */
  粉丝: string
  /** 分享链接 */
  share_url: string
}
