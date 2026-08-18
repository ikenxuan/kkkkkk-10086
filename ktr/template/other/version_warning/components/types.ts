/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

export interface VersionWarningData {
  /** 插件建议的 Yunzai 运行环境版本 */
  requireVersion: string
  /** 当前适配器报告的 Yunzai 运行环境版本 */
  currentVersion: string
}
