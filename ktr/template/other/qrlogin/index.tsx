import { defineTemplate } from '@karinjs/template-react'

import { QrLogin } from './components/qrlogin'

export default defineTemplate({
  name: 'APP扫码登录',
  description: 'APP扫码登录二维码页面',
  component: QrLogin
})
