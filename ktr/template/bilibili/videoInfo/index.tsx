import { defineTemplate } from '@karinjs/template-react'

import type { BilibiliVideoInfoData } from './components/types'
import { BilibiliVideoInfo } from './components/videoInfo'

export default defineTemplate({
  name: '视频信息',
  description: 'B站视频信息展示模板',
  component: BilibiliVideoInfo,
  validate: (data): data is BilibiliVideoInfoData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
