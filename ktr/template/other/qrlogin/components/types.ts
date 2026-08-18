/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/** APP 扫码登录组件属性 */
export interface QrLoginData {
  /** 服务器地址 */
  serverUrl: string
  /** 分享链接（用于生成二维码） */
  share_url: string
  /** 兼容旧调用方使用的二维码字段。 */
  qr_url?: string
}
