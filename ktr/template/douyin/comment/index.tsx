import { defineTemplate } from '@karinjs/template-react'

import { DouyinComment } from './components/Comment'
import type { DouyinCommentData } from './components/types'

export default defineTemplate({
  name: '评论列表',
  description: '抖音评论列表展示模板',
  component: DouyinComment,
  validate: (data): data is DouyinCommentData => typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
