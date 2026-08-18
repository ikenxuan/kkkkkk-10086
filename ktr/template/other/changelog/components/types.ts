/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * 更新日志组件属性接口
 */
export interface ChangelogData {
  /** 是否包含更新提示 */
  Tip?: boolean
  /** 后端传入的 Markdown 源码 */
  markdown: string
  /** 本地版本号 */
  localVersion: string
  /** 远程版本号 */
  remoteVersion: string
  /** 落后的版本数量 */
  lagVersionCount?: number
  /** 构建时间 */
  buildTime?: string
  /** 版本差异对比页面分享链接 */
  share_url?: string
}
