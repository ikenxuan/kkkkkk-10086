/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { RichTextDocument } from '@kkk/richtext'

import type { BilibiliAdditionalData, BilibiliDynamicBaseData } from '../../types'

/**
 * B站纯文动态组件属性接口
 */
export interface BilibiliWordDynamicData extends BilibiliDynamicBaseData {
  /** 动态文本内容（富文本文档） */
  text: RichTextDocument | null
  /** 相关内容卡片 */
  additional?: BilibiliAdditionalData
}
