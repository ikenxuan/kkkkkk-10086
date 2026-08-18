import { defineTemplate } from '@karinjs/template-react'

import { DouyinFavoriteList } from './components/FavoriteList'
import type { DouyinFavoriteListData } from './components/types'

export default defineTemplate({
  name: '喜欢列表',
  description: '抖音喜欢列表推送模板',
  component: DouyinFavoriteList,
  validate: (data): data is DouyinFavoriteListData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
