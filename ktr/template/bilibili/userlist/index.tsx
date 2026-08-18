import { defineTemplate } from '@karinjs/template-react'

import type { BilibiliUserListData } from './components/types'
import BilibiliUserList from './components/UserList'

export default defineTemplate({
  name: 'B站推送列表',
  description: 'B站用户推送列表组件',
  component: BilibiliUserList,
  validate: (data): data is BilibiliUserListData => typeof data === 'object' && data !== null && Array.isArray((data as any).renderOpt)
})
