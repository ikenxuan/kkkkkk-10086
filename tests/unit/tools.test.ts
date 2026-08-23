import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getKuaishouIDMock = vi.hoisted(() => vi.fn())
const getKuaishouDataMock = vi.hoisted(() => vi.fn())
const kuaishouActionMock = vi.hoisted(() => vi.fn())
const getBilibiliIDMock = vi.hoisted(() => vi.fn())
const bilibiliResourcesMock = vi.hoisted(() => vi.fn())
const getStatisticsDBMock = vi.hoisted(() => vi.fn())

const config = vi.hoisted(() => ({
  app: { videoTool: true, defaulttool: false, priority: 500 },
  douyin: { switch: true, douyintool: true, sendHDrecord: false },
  bilibili: { switch: true, bilibilitool: true },
  kuaishou: { switch: true, kuaishoutool: true },
  xiaohongshu: { switch: true },
  cookies: { douyin: '' }
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Config: config,
  Common: { getReplyMessage: vi.fn() },
  UploadRecord: vi.fn(),
  wrapWithErrorHandler: (fn: () => unknown) => async () => await fn(),
  downloadVideo: vi.fn(),
  baseHeaders: {}
}))

vi.mock('../../src/module/db/index.js', () => ({
  getStatisticsDB: getStatisticsDBMock
}))

vi.mock('../../src/module/platform/kuaishou/index.js', () => ({
  // vitest 4 把 `new` 转发给 vi.fn 的实现，而箭头函数天生不可构造。
  // src 里这三个都是 `new Xxx(...)` 调用，所以实现必须写成普通函数。
  KuaiShou: vi.fn(function () { return { Action: kuaishouActionMock } }),
  GetKuaishouID: getKuaishouIDMock,
  KuaishouData: vi.fn(function () { return { GetData: getKuaishouDataMock } })
}))

vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  Bilibili: vi.fn(function () { return { RESOURCES: bilibiliResourcesMock } }),
  getBilibiliID: getBilibiliIDMock
}))

vi.mock('../../src/module/platform/douyin/index.js', () => ({
  DouYin: vi.fn(),
  getDouyinID: vi.fn()
}))

vi.mock('../../src/module/platform/douyin/api.js', () => ({
  getDouyinData: vi.fn()
}))

vi.mock('../../src/module/platform/xiaohongshu/index.js', () => ({
  Xiaohongshu: vi.fn(),
  getXiaohongshuID: vi.fn()
}))

class PluginDouble {
  constructor (options: Record<string, unknown> = {}) {
    Object.assign(this, options)
  }
}

Object.assign(globalThis, { plugin: PluginDouble as unknown as typeof plugin })
globalThis.logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  mark: vi.fn()
} as unknown as typeof logger

const { kkkTools: ToolsApp } = await import('../../src/apps/tools.js')

const createEvent = (userId: string, groupId = 'group-1') => ({
  msg: 'https://v.kuaishou.com/abc',
  user_id: userId,
  group_id: groupId,
  reply: vi.fn()
})

beforeEach(() => {
  vi.useFakeTimers()
  getKuaishouIDMock.mockReset()
  getKuaishouDataMock.mockReset()
  kuaishouActionMock.mockReset()
  getBilibiliIDMock.mockReset()
  bilibiliResourcesMock.mockReset()
  getStatisticsDBMock.mockReset()
  getStatisticsDBMock.mockResolvedValue(null)
  getKuaishouIDMock.mockResolvedValue({ type: 'one_work', photoId: 'photo-1', P: '快手' })
  getKuaishouDataMock.mockResolvedValue({ VideoData: {}, CommentData: {}, EmojiData: {} })
  kuaishouActionMock.mockResolvedValue(true)
  getBilibiliIDMock.mockResolvedValue({ type: 'one_work', bvid: 'BV1234567890' })
  bilibiliResourcesMock.mockResolvedValue(true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('kkkTools kuaishou dispatch', () => {
  it('passes the matched URL string to GetKuaishouID', async () => {
    const event = createEvent('user-1')

    await new ToolsApp()._kuaishou(event)

    expect(getKuaishouIDMock).toHaveBeenCalledWith('https://v.kuaishou.com/abc')
    expect(getKuaishouIDMock.mock.calls[0]?.[0]).not.toEqual(expect.any(Array))
    expect(kuaishouActionMock).toHaveBeenCalledTimes(1)
  })
})

describe('kkkTools episode selection state', () => {
  it('keeps episode state isolated by group and user', async () => {
    const owner = createEvent('owner')
    await new ToolsApp()._bilibili(owner)

    const otherUser = { ...createEvent('other-user'), msg: '#第2集' }
    await new ToolsApp().next(otherUser)
    expect(bilibiliResourcesMock).toHaveBeenCalledTimes(1)

    const ownerEpisode = { ...owner, msg: '#第3集' }
    await new ToolsApp().next(ownerEpisode)

    expect(bilibiliResourcesMock).toHaveBeenCalledTimes(2)
    expect(bilibiliResourcesMock).toHaveBeenLastCalledWith(expect.objectContaining({ Episode: '3' }))
  })

  it('does not reuse episode state across groups for the same user', async () => {
    const owner = createEvent('owner', 'group-1')
    await new ToolsApp()._bilibili(owner)

    await new ToolsApp().next({ ...createEvent('owner', 'group-2'), msg: '#第2集' })

    expect(bilibiliResourcesMock).toHaveBeenCalledTimes(1)
  })
})
