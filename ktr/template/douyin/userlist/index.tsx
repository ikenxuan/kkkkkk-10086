import { defineTemplate } from '@karinjs/template-react'

import type { DouyinUserListData } from './components/types'
import DouyinUserList from './components/UserList'

export default defineTemplate({
  name: '抖音推送列表',
  description: '抖音用户推送列表组件',
  component: DouyinUserList,
  validate: (data): data is DouyinUserListData => typeof data === 'object' && data !== null && Array.isArray((data as any).renderOpt)
})
