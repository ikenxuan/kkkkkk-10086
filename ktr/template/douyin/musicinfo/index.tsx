import { defineTemplate } from '@karinjs/template-react'

import { DouyinMusicInfo } from './components/MusicInfo'
import type { DouyinMusicInfoData } from './components/types'

export default defineTemplate({
  name: '音乐信息',
  description: '抖音音乐信息展示模板',
  component: DouyinMusicInfo,
  validate: (data): data is DouyinMusicInfoData => typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
