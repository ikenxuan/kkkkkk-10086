import { defineTemplate } from '@karinjs/template-react'

import { BilibiliWordDynamic } from './components/DYNAMIC_TYPE_WORD'
import type { BilibiliWordDynamicData } from './components/types'

export default defineTemplate({
  name: '纯文动态',
  description: 'B站纯文动态展示模板',
  component: BilibiliWordDynamic,
  validate: (data): data is BilibiliWordDynamicData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
