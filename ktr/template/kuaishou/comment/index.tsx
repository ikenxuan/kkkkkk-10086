import { defineTemplate } from '@karinjs/template-react'

import { KuaishouComment } from './components/Comment'
import type { KuaishouCommentData } from './components/types'

export default defineTemplate({
  name: '评论列表',
  description: '快手视频评论列表展示模板',
  component: KuaishouComment,
  validate: (data): data is KuaishouCommentData => typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
