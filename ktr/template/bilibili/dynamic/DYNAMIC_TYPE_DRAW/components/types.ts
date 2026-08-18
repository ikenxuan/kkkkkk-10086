/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { RichTextDocument } from '@kkk/richtext'

import type { BilibiliAdditionalData, BilibiliDynamicBaseData } from '../../types'

/**
 * B站普通动态组件属性接口
 */
export interface BilibiliDynamicData extends BilibiliDynamicBaseData {
  /** 图文动态标题 */
  title?: string
  /** 动态文本内容（富文本文档） */
  text: RichTextDocument | null
  /** 图片URL数组 */
  image_url: Array<{ image_src: string }>
  /** 图片布局方式 */
  imageLayout: string
  /** 相关内容卡片 */
  additional?: BilibiliAdditionalData
}
