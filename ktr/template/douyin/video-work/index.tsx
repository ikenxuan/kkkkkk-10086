import { defineTemplate } from '@karinjs/template-react'

import type { DouyinVideoWorkData } from './components/types'
import { DouyinVideoWork } from './components/VideoWork'

export default defineTemplate({
  name: '视频作品',
  description: '抖音视频作品解析与推送模板',
  component: DouyinVideoWork,
  validate: (data): data is DouyinVideoWorkData => typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
