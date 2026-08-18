import { defineTemplate } from '@karinjs/template-react'

import { BilibiliDrawDynamic } from './components/DYNAMIC_TYPE_DRAW'
import type { BilibiliDynamicData } from './components/types'

export default defineTemplate({
  name: '图文动态',
  description: 'B站图文动态展示模板',
  component: BilibiliDrawDynamic,
  validate: (data): data is BilibiliDynamicData => typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
