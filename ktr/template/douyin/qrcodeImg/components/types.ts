/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/** 抖音二维码登录组件属性 */
export interface DouyinQrcodeImgData {
  /** 分享链接（用于生成自定义二维码） */
  share_url?: string
  /** 触发登录的用户头像 URL，嵌入二维码中心作为 logo；缺省时生成普通二维码 */
  avatarUrl?: string
}
