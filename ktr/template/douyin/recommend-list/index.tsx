import { defineTemplate } from '@karinjs/template-react'

import { DouyinRecommendList } from './components/RecommendList'
import type { DouyinRecommendListData } from './components/types'

export default defineTemplate({
  name: '推荐列表',
  description: '抖音推荐列表推送模板',
  component: DouyinRecommendList,
  validate: (data): data is DouyinRecommendListData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
