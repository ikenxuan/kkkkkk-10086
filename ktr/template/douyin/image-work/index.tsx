import { defineTemplate } from '@karinjs/template-react'

import { DouyinImageWork } from './components/ImageWork'
import type { DouyinImageWorkData } from './components/types'

export default defineTemplate({
  name: '图文作品',
  description: '抖音图文作品解析与推送模板',
  component: DouyinImageWork,
  validate: (data): data is DouyinImageWorkData => typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
