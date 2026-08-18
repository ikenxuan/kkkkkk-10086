import { defineTemplate } from '@karinjs/template-react'

import { DouyinLive } from './components/Live'
import type { DouyinLiveData } from './components/types'

export default defineTemplate({
  name: '直播状态',
  description: '抖音直播状态推送模板',
  component: DouyinLive,
  validate: (data): data is DouyinLiveData => typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
