import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CommandEvent } from '../../src/types/message.js'

/**
 * 帮助卡数据的护栏。
 *
 * 起因：`#kkk录直播` 上线时忘了加进帮助卡，而当时帮助卡内容零覆盖，九步 `pnpm check`
 * 里没有一道闸会红 —— 命令能用但用户翻不到它。
 *
 * 所以这里钉两件事，都是 review 肉眼容易漏的：
 *
 * - **字段齐全**。`HelpItem` 的 `icon` 与 `roles` 在类型上是可选的（模板契约允许
 *   缺 icon，`filterItems` 也容忍缺 roles），于是漏写不会有任何类型错误。漏 `icon`
 *   只是掉成问号图标，漏 `roles` 却是权限问题：`filterItems` 的
 *   `!item.roles || ...` 会把没写 roles 的条目发给所有人，主人专属命令就此泄给普通成员。
 * - **录直播在卡里**。它是上面那次遗漏的回归测试，所以断言按标题子串找条目，
 *   而不是钉整条文案 —— 文案本来就该能改。
 *
 * 不断言 description 的具体内容（平台名、时长上限）：那些值跟着
 * `common/liveRecord.ts` 的常量走，钉在这里等于把「改配置要同步改两处」变成
 * 「改配置要同步改三处」。
 */

/** 平台开关全开，让 `enabledPlatforms()` 走有平台可用的那条分支 */
const config = vi.hoisted(() => ({
  douyin: { switch: true, push: { permission: 'all' } },
  bilibili: { switch: true, push: { permission: 'master' } },
  kuaishou: { switch: true },
  xiaohongshu: { switch: true }
}))

const doubles = vi.hoisted(() => ({ render: vi.fn() }))

// help.ts 从 utils 的 barrel 里取 Render 与 Config，而真 Config 在求值时就去读宿主
// 的 lib/config —— 本文件只关心菜单数据，不需要真配置。
vi.mock('../../src/module/utils/index.js', () => ({
  Config: config,
  Render: doubles.render
}))
// 这两个只被 `#kkk版本` 用到，但都在模块作用域被 import，且各自会真的摸文件系统。
vi.mock('../../src/module/utils/runtime-report.js', () => ({ collectRuntimeReport: vi.fn() }))
vi.mock('../../src/module/utils/yunzaiVersion.js', () => ({ checkYunzaiVersion: vi.fn(() => null) }))

/** Yunzai `plugin` 基类的最小替身：`kkkHelp` 在模块求值时就会继承它 */
class PluginDouble {
  constructor (options: Record<string, unknown> = {}) {
    Object.assign(this, options)
  }
}

Object.assign(globalThis, { plugin: PluginDouble as unknown as typeof plugin })
globalThis.logger = {
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), mark: vi.fn()
} as unknown as typeof logger

// 替身装好之后再导入：help.ts 在模块求值时就会读 `plugin`
const { kkkHelp: KkkHelp } = await import('../../src/apps/help.js')
// buildHelpGroups 住在 module/help/content：apps/*.js 只允许一个具名导出，见那里的说明
const { buildHelpGroups } = await import('../../src/module/help/content.js')

type HelpGroup = ReturnType<typeof buildHelpGroups>[number]
type HelpItem = HelpGroup['items'][number]

/** 一个分组连同它的子分组里的所有条目 */
const allItems = (group: HelpGroup): HelpItem[] => [
  ...group.items,
  ...(group.subGroups?.flatMap(sub => sub.items) ?? [])
]

const everyItem = (): Array<{ group: string, item: HelpItem }> =>
  buildHelpGroups().flatMap(group =>
    allItems(group).map(item => ({ group: group.title, item }))
  )

describe('帮助卡菜单数据', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('每个条目都写齐了 title / description / icon / roles', () => {
    const entries = everyItem()
    // 空数组会让下面的 for 一条都不跑、测试假绿
    expect(entries.length).toBeGreaterThan(0)

    for (const { group, item } of entries) {
      const where = `${group} / ${item.title}`
      expect(item.title, `${where}: title 不能为空`).toBeTruthy()
      expect(item.description, `${where}: description 不能为空`).toBeTruthy()

      // icon 允许是字符串或 { name, color }，两种形状都得有个非空的图标名
      const iconName = typeof item.icon === 'string' ? item.icon : item.icon?.name
      expect(iconName, `${where}: icon 不能为空`).toBeTruthy()

      // 漏 roles 不是显示问题而是权限问题，见文件头注释
      expect(Array.isArray(item.roles), `${where}: roles 必须是数组`).toBe(true)
      expect(item.roles?.length, `${where}: roles 不能是空数组`).toBeGreaterThan(0)
    }
  })

  it('#kkk录直播 在帮助卡里，且字段齐全', () => {
    const found = everyItem().filter(({ item }) => item.title.includes('kkk录直播'))

    expect(found, '帮助卡里必须有 #kkk录直播 的条目').toHaveLength(1)
    const item = found[0]!.item

    expect(item.description).toBeTruthy()
    const iconName = typeof item.icon === 'string' ? item.icon : item.icon?.name
    expect(iconName).toBeTruthy()
    expect(item.roles?.length).toBeGreaterThan(0)
  })

  it('普通成员的帮助页里也有 #kkk录直播', async () => {
    // `tools.ts` 里这条规则没设 permission，所以它不能是主人专属。
    // 这一条走真实渲染路径（buildMenuForRole 的角色过滤），因此也顺带证明
    // 上面两条验的数据确实是发给用户的那份。
    doubles.render.mockResolvedValue('image-segment')
    const reply = vi.fn()
    const app = new KkkHelp()

    await app.help({ isMaster: false, reply } as unknown as CommandEvent)

    expect(doubles.render).toHaveBeenCalledTimes(1)
    const [templatePath, params] = doubles.render.mock.calls[0] as [string, {
      menu: Array<{ items: Array<{ title: string }>, subGroups?: Array<{ items: Array<{ title: string }> }> }>
    }]
    expect(templatePath).toBe('other/help')

    const titles = params.menu.flatMap(group => [
      ...group.items.map(item => item.title),
      ...(group.subGroups?.flatMap(sub => sub.items.map(item => item.title)) ?? [])
    ])
    expect(titles.some(title => title.includes('kkk录直播'))).toBe(true)
    expect(reply).toHaveBeenCalledWith('image-segment')
  })

  it('主人专属条目不进普通成员的帮助页', async () => {
    // 上一条只证明「录直播出现了」，不能证明过滤器还活着 —— 如果 filterItems 哪天
    // 变成直通，这条会红。
    doubles.render.mockResolvedValue('image-segment')
    const app = new KkkHelp()

    await app.help({ isMaster: false, reply: vi.fn() } as unknown as CommandEvent)

    const [, params] = doubles.render.mock.calls[0] as [string, {
      menu: Array<{ items: Array<{ title: string }>, subGroups?: Array<{ items: Array<{ title: string }> }> }>
    }]
    const titles = params.menu.flatMap(group => [
      ...group.items.map(item => item.title),
      ...(group.subGroups?.flatMap(sub => sub.items.map(item => item.title)) ?? [])
    ])

    const masterOnly = everyItem()
      .filter(({ item }) => item.roles?.length === 1 && item.roles[0] === 'master')
      .map(({ item }) => item.title)
    expect(masterOnly.length, '至少得有一条主人专属条目，否则本条测试没在验东西').toBeGreaterThan(0)

    for (const title of masterOnly) {
      expect(titles, `${title} 是主人专属，不该出现在成员视图里`).not.toContain(title)
    }
  })
})
