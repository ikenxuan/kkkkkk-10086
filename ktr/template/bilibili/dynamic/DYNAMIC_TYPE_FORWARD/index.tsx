import { defineTemplate } from '@karinjs/template-react'

import { BilibiliForwardDynamic } from './components/DYNAMIC_TYPE_FORWARD'
import type { BilibiliForwardDynamicData } from './components/types'

export default defineTemplate({
  name: '转发动态',
  description: 'B站转发动态展示模板',
  component: BilibiliForwardDynamic,
  validate: (data): data is BilibiliForwardDynamicData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
