import { defineTemplate } from '@karinjs/template-react'

import { BilibiliQrcodeImg } from './components/qrcodeImg'
import type { BilibiliQrcodeImgData } from './components/types'

export default defineTemplate({
  name: '登录二维码',
  description: 'B站登录二维码展示模板',
  component: BilibiliQrcodeImg,
  validate: (data): data is BilibiliQrcodeImgData =>
    typeof data === 'object' && data !== null && typeof (data as any).share_url === 'string'
})
