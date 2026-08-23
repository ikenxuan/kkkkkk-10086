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
