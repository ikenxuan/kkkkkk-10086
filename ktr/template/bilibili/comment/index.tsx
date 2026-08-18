import { defineTemplate } from '@karinjs/template-react'

import { BilibiliComment } from './components/Comment'
import type { BilibiliCommentData } from './components/types'

export default defineTemplate({
  name: '评论列表',
  description: 'B站视频稿件评论列表展示模板',
  component: BilibiliComment,
  validate: (data): data is BilibiliCommentData => typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
