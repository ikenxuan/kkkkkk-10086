import { defineTemplate } from '@karinjs/template-react'

import { DouyinDynamic } from './components/Dynamic'
import type { DouyinDynamicData } from './components/types'

export default defineTemplate({
  name: '作品列表',
  description: '抖音作品列表推送模板',
  component: DouyinDynamic,
  validate: (data): data is DouyinDynamicData => typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
