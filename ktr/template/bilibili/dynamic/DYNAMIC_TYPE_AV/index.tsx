import { defineTemplate } from '@karinjs/template-react'

import { BilibiliVideoDynamic } from './components/DYNAMIC_TYPE_AV'
import type { BilibiliVideoDynamicData } from './components/types'

export default defineTemplate({
  name: '视频动态',
  description: 'B站视频动态展示模板',
  component: BilibiliVideoDynamic,
  validate: (data): data is BilibiliVideoDynamicData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
