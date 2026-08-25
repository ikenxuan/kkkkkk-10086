import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildGroupUserRanking } from '../../src/module/platform/common/userRanking.js'
import type { GroupUserRankingRow } from '../../src/types/database.js'
import type { MessageEvent } from '../../src/types/message.js'

/** 造一行 getGroupUserRanking() 形状的聚合结果 */
const row = (userId: string, overrides: Partial<GroupUserRankingRow> = {}): GroupUserRankingRow => ({
  userId,
  totalParses: 1,
  douyin: 1,
  bilibili: 0,
  kuaishou: 0,
  xiaohongshu: 0,
  ...overrides
})

/** 造一个只带 gml 的假 Bot，模拟宿主的群成员表 */
const eventWithMembers = (
  members: Map<string | number, unknown>,
  groupKey: string | number = '10086'
): MessageEvent => ({
  bot: { gml: new Map([[groupKey, members]]) }
} as unknown as MessageEvent)

describe('buildGroupUserRanking', () => {
  it('群名片优先于昵称', () => {
    const e = eventWithMembers(new Map([['1', { card: '名片', nickname: '昵称' }]]))

    expect(buildGroupUserRanking(e, '10086', [row('1')])[0]?.nickname).toBe('名片')
  })

  it('没有名片时退回昵称，两者都没有时退回 name', () => {
    const e = eventWithMembers(new Map<string | number, unknown>([
      ['1', { nickname: '昵称' }],
      ['2', { name: '只有 name' }]
    ]))

    const ranking = buildGroupUserRanking(e, '10086', [row('1'), row('2')])
    expect(ranking.map(entry => entry.nickname)).toEqual(['昵称', '只有 name'])
  })

  it('群号与用户号都按宿主的 Number(id) || id 归一化，number 键也查得到', () => {
    // icqq 的 gml 两层键都是 number
    const e = eventWithMembers(new Map<string | number, unknown>([[114514, { card: '数字键' }]]), 10086)

    expect(buildGroupUserRanking(e, '10086', [row('114514')])[0]?.nickname).toBe('数字键')
  })

  it('查不到昵称时短 ID 原样显示', () => {
    const e = eventWithMembers(new Map())

    expect(buildGroupUserRanking(e, '10086', [row('114514')])[0]?.nickname).toBe('114514')
  })

  it('查不到昵称时长 openid 截断成头尾，不整串铺出来', () => {
    const openid = 'A1B2C3D4E5F60718293A4B5C6D7E8F90'
    const e = eventWithMembers(new Map())

    const entry = buildGroupUserRanking(e, '10086', [row(openid)])[0]
    expect(entry?.nickname).toBe('A1B2C3…8F90')
    // userId 本身不动，模板那一行照样能显示完整 ID
    expect(entry?.userId).toBe(openid)
  })

  it('纯数字 QQ 号给头像直链，openid 不给', () => {
    const e = eventWithMembers(new Map())

    expect(buildGroupUserRanking(e, '10086', [row('114514')])[0]?.avatar)
      .toBe('https://q1.qlogo.cn/g?b=qq&nk=114514&s=640')
    expect(buildGroupUserRanking(e, '10086', [row('A1B2C3D4E5F6')])[0]?.avatar).toBeUndefined()
  })

  it('平台分布原样带过去，次数与顺序都不改', () => {
    const e = eventWithMembers(new Map())

    expect(buildGroupUserRanking(e, '10086', [
      row('1', { totalParses: 7, douyin: 3, bilibili: 2, kuaishou: 1, xiaohongshu: 1 })
    ])).toEqual([
      {
        userId: '1',
        nickname: '1',
        totalParses: 7,
        avatar: undefined,
        platforms: { douyin: 3, bilibili: 2, kuaishou: 1, xiaohongshu: 1 }
      }
    ])
  })

  it('宿主完全没有 gml 时不炸，全部回落成 userId', () => {
    const e = {} as MessageEvent

    expect(buildGroupUserRanking(e, '10086', [row('114514')])[0]?.nickname).toBe('114514')
  })

  it('空输入返回空数组', () => {
    expect(buildGroupUserRanking({} as MessageEvent, '10086', [])).toEqual([])
  })
})

/**
 * 排行区块里「名字」那几格的裁字回归。
 *
 * 为什么读源码而不是渲染组件：出问题的是 CSS 裁切，而裁没裁只有真正出图
 * （puppeteer 的布局 + 亚像素取整）时才看得出来；jsdom 没有布局引擎，
 * 渲染出 DOM 也测不到「字符被切掉一半」。所以这里钉的是唯一那条复发入口 ——
 * 「别再把裁切类名加回这几格」。
 */
const templateSource = (path: string): string => readFileSync(resolve(import.meta.dirname, '..', '..', path), 'utf8')

const GROUP_STATISTICS = 'ktr/template/statistics/group/components/GroupStatistics.tsx'
const GLOBAL_STATISTICS = 'ktr/template/statistics/global/components/GlobalStatistics.tsx'

/**
 * 会把字形裁掉一半的类名。
 *
 * `truncate` 是 overflow:hidden + white-space:nowrap + text-overflow:ellipsis 三件套，
 * 后面几个是把它拆开写时的等价物 —— 只要盒子宽度是 flex 压出来的分数值，
 * 省略号就可能画不出来而绘制照样停在边界上，也就是「最后一个字符只剩一半」。
 */
const CLIPPING_CLASSES = ['truncate', 'overflow-hidden', 'text-ellipsis', 'whitespace-nowrap', 'line-clamp']

/**
 * 取「直接渲染 `{expr}...` 的那个元素」的 className 串。
 *
 * 不用正则整段匹配：昵称这类表达式在同一个组件里还会出现在 `alt=` / `key=` 上，
 * 靠「紧挨在 `">` 后面」这个位置关系筛出真正带样式的那一个，比堆转义可靠。
 */
const classNameRendering = (source: string, expr: string): string => {
  const needle = `{${expr}`
  for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) {
    // JSX 里标签和表达式之间可能换行缩进，先把这段空白去掉再看是不是标签结尾
    const before = source.slice(0, at).replace(/\s+$/, '')
    if (!before.endsWith('">')) continue
    const opens = before.lastIndexOf('className="')
    if (opens === -1) continue
    const className = before.slice(opens + 'className="'.length, before.length - 2)
    // 收尾的 `">` 也可能是别的属性（alt= 之类）的，那种情况下切出来会跨过引号
    if (className.includes('"')) continue
    return className
  }
  throw new Error(`模板里找不到渲染 ${expr} 的元素，这条断言要跟着模板一起更新`)
}

describe('排行区块的名字不能被裁', () => {
  it.each([
    ['用户排行 · 昵称', GROUP_STATISTICS, 'user.nickname'],
    ['用户排行 · userId', GROUP_STATISTICS, 'user.userId'],
    ['群组排行 · 群名', GLOBAL_STATISTICS, 'group.groupName'],
    ['群组排行 · 群号', GLOBAL_STATISTICS, 'group.groupId']
  ])('%s 用 break-all 换行，不带任何裁切类名', (_name, template, expr) => {
    const className = classNameRendering(templateSource(template), expr)

    // 必须是 break-all 而不是 break-words：只有它会压低 min-content 宽度，
    // 长昵称 / openid 才缩得进被 flex 压窄的那一列，理由详见模板里的注释
    expect(className.split(/\s+/)).toContain('break-all')
    for (const clipping of CLIPPING_CLASSES) {
      expect(className).not.toContain(clipping)
    }
  })
})
