import { defineTemplate } from '@karinjs/template-react'

import { BilibiliArticleDynamic } from './components/DYNAMIC_TYPE_ARTICLE'
import type { BilibiliArticleDynamicData } from './components/types'

export default defineTemplate({
  name: '专栏动态',
  description: 'B站专栏动态展示模板',
  component: BilibiliArticleDynamic,
  validate: (data): data is BilibiliArticleDynamicData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
