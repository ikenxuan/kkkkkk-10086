import { defineTemplate } from '@karinjs/template-react'

import { BilibiliLiveDynamic } from './components/DYNAMIC_TYPE_LIVE_RCMD'
import type { BilibiliLiveDynamicData } from './components/types'

export default defineTemplate({
  name: '直播动态',
  description: 'B站直播动态展示模板',
  component: BilibiliLiveDynamic,
  validate: (data): data is BilibiliLiveDynamicData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
