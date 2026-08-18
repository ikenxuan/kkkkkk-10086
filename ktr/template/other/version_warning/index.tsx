import { defineTemplate } from '@karinjs/template-react'

import { VersionWarning } from './components/VersionWarning'

export default defineTemplate({
  name: '版本警告',
  description: '版本不兼容警告页面',
  component: VersionWarning
})
