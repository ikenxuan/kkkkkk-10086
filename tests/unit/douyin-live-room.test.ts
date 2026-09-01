import { describe, expect, it, vi } from 'vitest'

import type { DouyinLiveApiFetcher } from '../../src/module/platform/douyin/live-room.js'

/**
 * `douyin/live-room.ts` 的两步解析护栏。
 *
 * 这条链路的失败模式全是「amagi 的 zod 当场抛 invalid_type」或者「拿着错的号去请求、
 * 接口回一份空数据」，两种都表现成用户侧的静默失败，所以重点在三件事：
 *
 * 1. **room_id 不是 web_rid**。「直播间信息数据」的 room_id 要的是用户主页里的
 *    `room_id_str`（内部房间号），而 URL 里能提取到的只有 web_rid。传错号接口能通，
 *    但回来的不是这个房间。
 * 2. **两个参数都得非空**。amagi 对 room_id / web_rid 都做非空 string 校验，
 *    少一个直接 invalid_type。
 * 3. **两条入口的补号方向相反**。webcast 分享链接只有 sec_uid，`live.douyin.com`
 *    直链只有 web_rid，后者必须先探一次直播间才能拿到 sec_uid。
 *
 * 取数客户端是入参而不是 import，所以这里不需要任何 vi.mock —— 直接给一个记账用的
 * 假 fetcher，断言它收到的方法名和参数。
 */

globalThis.logger = {
  debug: vi.fn(), error: vi.fn(), info: vi.fn(), mark: vi.fn(), warn: vi.fn()
} as unknown as typeof logger

const { resolveDouyinLiveRoom } = await import('../../src/module/platform/douyin/live-room.js')

/**
 * 方法名从被测模块的入参类型上取，下面的期望序列都用 `satisfies` 钉在它上面。
 * `toEqual` 的形参是无约束泛型，光写字面量的话方法名再改一次这里会静默变成
 * 「断言一串谁也不会调用的名字」—— 是 satisfies 那一句让它在类型检查时就报出来。
 */
type DouyinLiveApiMethod = Parameters<DouyinLiveApiFetcher>[0]

/** 一次被拦下来的取数调用 */
interface FetchCall {
  method: DouyinLiveApiMethod
  options: Record<string, unknown>
}

/**
 * 按「第几次调用」依次返回给定响应的假 fetcher。
 * 响应给完之后再被调用会抛，免得漏掉「多打了一次接口」这种回归。
 */
const createFetcher = (responses: readonly unknown[]): {
  fetch: DouyinLiveApiFetcher
  calls: FetchCall[]
} => {
  const calls: FetchCall[] = []
  let index = 0
  return {
    calls,
    fetch: async (method, options) => {
      calls.push({ method, options })
      if (index >= responses.length) throw new Error(`多余的取数调用：${method}`)
      return responses[index++]
    }
  }
}

/** 在播的用户主页数据 */
const livingUser = (overrides: Record<string, unknown> = {}): unknown => ({
  data: {
    user: {
      nickname: '主播甲',
      live_status: 1,
      room_id_str: '7300000000000000000',
      room_data: JSON.stringify({ owner: { web_rid: '26139686' } }),
      ...overrides
    }
  }
})

/** 一份最小可用的直播间信息数据 */
const roomDetail = (overrides: Record<string, unknown> = {}): unknown => ({
  data: {
    data: [{ title: '在播标题', owner: { web_rid: '26139686' } }],
    partition_road_map: { partition: { title: '娱乐' } },
    ...overrides
  }
})

describe('resolveDouyinLiveRoom 的两步补号', () => {
  it('只有 sec_uid（webcast 分享链接）时不多探一次直播间', async () => {
    const { fetch, calls } = createFetcher([livingUser(), roomDetail()])

    const room = await resolveDouyinLiveRoom({ sec_uid: 'MS4wLjABAAAA' }, fetch)

    expect(calls.map(call => call.method))
      .toEqual(['fetchUserProfile', 'fetchLiveRoomInfo'] satisfies DouyinLiveApiMethod[])
    expect(calls[0]?.options).toMatchObject({ sec_uid: 'MS4wLjABAAAA' })
    expect(room.living).toBe(true)
  })

  it('只有 web_rid（live.douyin.com 直链）时先探直播间换 sec_uid', async () => {
    const probe = { data: { data: { user: { sec_uid: 'MS4wProbe' } } } }
    const { fetch, calls } = createFetcher([probe, livingUser(), roomDetail()])

    await resolveDouyinLiveRoom({ room_id: '26139686' }, fetch)

    expect(calls.map(call => call.method))
      .toEqual(['fetchLiveRoomInfo', 'fetchUserProfile', 'fetchLiveRoomInfo'] satisfies DouyinLiveApiMethod[])
    // 探测这一跳手上只有 web_rid，所以两个参数都填它 —— 这一步 amagi 只要求非空。
    expect(calls[0]?.options).toMatchObject({ room_id: '26139686', web_rid: '26139686' })
    expect(calls[1]?.options).toMatchObject({ sec_uid: 'MS4wProbe' })
  })

  it('正式那一跳的 room_id 用 room_id_str，web_rid 用 room_data 里的号', async () => {
    const { fetch, calls } = createFetcher([livingUser(), roomDetail()])

    await resolveDouyinLiveRoom({ sec_uid: 'MS4wLjABAAAA' }, fetch)

    // 这条断言是本文件的核心：room_id 必须是内部房间号而不是 web_rid，
    // 两者都必须非空，否则 amagi 的 zod 直接 invalid_type。
    expect(calls[1]?.options).toEqual({
      room_id: '7300000000000000000',
      web_rid: '26139686',
      typeMode: 'strict'
    })
  })

  it('room_id_str 缺失时回落到 web_rid，不会传出一个空 room_id', async () => {
    const { fetch, calls } = createFetcher([
      livingUser({ room_id_str: undefined }),
      roomDetail()
    ])

    await resolveDouyinLiveRoom({ sec_uid: 'MS4wLjABAAAA' }, fetch)

    expect(calls[1]?.options).toMatchObject({ room_id: '26139686', web_rid: '26139686' })
  })

  it('在播时带出房间项、分区与 web_rid', async () => {
    const { fetch } = createFetcher([livingUser(), roomDetail()])

    const room = await resolveDouyinLiveRoom({ sec_uid: 'MS4wLjABAAAA' }, fetch)

    expect(room).toMatchObject({
      living: true,
      partitionTitle: '娱乐',
      webRid: '26139686'
    })
    if (!room.living) throw new Error('上一句断言已经确认在播')
    expect(room.liveItem.title).toBe('在播标题')
    expect(room.anchor.nickname).toBe('主播甲')
  })

  it('响应多包一层 `data` 时照样读得到房间项', async () => {
    // 直播间信息数据有 `data.data` 是对象（再往里才是列表）和 `data.data` 直接是列表
    // 两种形态 —— 上面那些用例走的是后者，这里守的是前者。getLiveRoot 统一收口，
    // 少了那层判断就会拿着一个数组去读 `.data`，得到 undefined、判成「返回格式异常」。
    const nested = {
      data: { data: { data: [{ title: '多包一层' }], partition_road_map: { partition: { title: '游戏' } } } }
    }
    const { fetch } = createFetcher([livingUser(), nested])

    const room = await resolveDouyinLiveRoom({ sec_uid: 'MS4wLjABAAAA' }, fetch)

    if (!room.living) throw new Error('应当判为在播')
    expect(room.liveItem.title).toBe('多包一层')
    expect(room.partitionTitle).toBe('游戏')
  })

  it('未开播时只带主播，不再打第二次直播间接口', async () => {
    const { fetch, calls } = createFetcher([livingUser({ live_status: 0 })])

    const room = await resolveDouyinLiveRoom({ sec_uid: 'MS4wLjABAAAA' }, fetch)

    expect(room).toEqual({ living: false, anchor: expect.objectContaining({ nickname: '主播甲' }) })
    expect(calls.map(call => call.method)).toEqual(['fetchUserProfile'] satisfies DouyinLiveApiMethod[])
  })
})

describe('resolveDouyinLiveRoom 的失败路径', () => {
  it('两个号都没有时当场抛，不去打接口', async () => {
    const { fetch, calls } = createFetcher([])

    await expect(resolveDouyinLiveRoom({}, fetch)).rejects.toThrow('直播间链接缺少 sec_uid 与房间号，无法解析')
    expect(calls).toHaveLength(0)
  })

  it('探测响应里没有主播信息时抛出可读原因', async () => {
    const { fetch } = createFetcher([{ data: {} }])

    await expect(resolveDouyinLiveRoom({ room_id: '26139686' }, fetch))
      .rejects.toThrow('直播间信息数据未返回主播信息，可能已关播或抖音 Cookie 失效')
  })

  it('接口回的不是对象时按「返回格式异常」抛，带上是哪个接口', async () => {
    const { fetch } = createFetcher(['<html>429</html>'])

    await expect(resolveDouyinLiveRoom({ sec_uid: 'MS4wLjABAAAA' }, fetch))
      .rejects.toThrow('用户主页数据返回格式异常')
  })

  it('房间列表为空时抛，而不是返回一个没有 liveItem 的「在播」', async () => {
    const { fetch } = createFetcher([livingUser(), roomDetail({ data: [] })])

    await expect(resolveDouyinLiveRoom({ sec_uid: 'MS4wLjABAAAA' }, fetch))
      .rejects.toThrow('直播间信息数据返回格式异常')
  })
})
