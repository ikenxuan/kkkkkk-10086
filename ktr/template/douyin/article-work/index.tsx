import { defineTemplate } from '@karinjs/template-react'

import { DouyinArticleWork } from './components/ArticleWork'
import type { DouyinArticleWorkData } from './components/types'

export default defineTemplate({
  name: '文章作品',
  description: '抖音文章作品解析与推送模板',
  component: DouyinArticleWork,
  validate: (data): data is DouyinArticleWorkData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
