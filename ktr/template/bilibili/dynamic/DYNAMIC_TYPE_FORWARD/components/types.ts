/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { RichTextDocument } from '@kkk/richtext'

import type { BilibiliDynamicBaseData, BilibiliForwardOriginalContentProps } from '../../types'

/**
 * B站转发动态组件属性接口
 */
export interface BilibiliForwardDynamicData extends BilibiliDynamicBaseData {
  /** 动态文本内容（富文本文档） */
  text: RichTextDocument
  /** 原始内容 */
  original_content: BilibiliForwardOriginalContentProps['original_content']
  /** 图片URL */
  imgList: string[] | null
}
