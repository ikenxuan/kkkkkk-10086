import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDouyinIdMock = vi.hoisted(() => vi.fn())
const douyinResourcesMock = vi.hoisted(() => vi.fn())
const getReplyMessageMock = vi.hoisted(() => vi.fn())
const downloadVideoMock = vi.hoisted(() => vi.fn())
const wrapWithErrorHandlerMock = vi.hoisted(() => vi.fn())
const recordParseMock = vi.hoisted(() => vi.fn(async () => {}))
const reactionStates = vi.hoisted(() => new Map<string, string[]>())

const configMock = vi.hoisted(() => ({
  app: {
    videoTool: true,
    defaulttool: true,
    priority: 100,
    parseConcurrency: 2
  },
  douyin: { switch: true },
  bilibili: { switch: true },
  kuaishou: { switch: true },
  xiaohongshu: { switch: true }
}))

vi.mock('../../src/module/platform/douyin/index.js', () => ({
  getDouyinID: getDouyinIdMock,
  DouYin: class {
    RESOURCES = douyinResourcesMock
  }
}))

vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  getBilibiliID: vi.fn(),
  Bilibili: class {}
}))

vi.mock('../../src/module/platform/kuaishou/index.js', () => ({
  GetKuaishouID: vi.fn(),
  KuaiShou: class {},
  KuaishouData: class {}
}))

vi.mock('../../src/module/platform/xiaohongshu/index.js', () => ({
  getXiaohongshuID: vi.fn(),
  Xiaohongshu: class {}
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Config: configMock,
  Common: { getReplyMessage: getReplyMessageMock },
  UploadRecord: vi.fn(),
  downloadVideo: downloadVideoMock,
  baseHeaders: {},
  wrapWithErrorHandler: wrapWithErrorHandlerMock
}))

vi.mock('../../src/module/db/index.js', () => ({
  getStatisticsDB: async () => ({ recordParse: recordParseMock })
}))

vi.mock('../../src/module/platform/douyin/api.js', () => ({
  getDouyinData: vi.fn()
}))

vi.mock('../../src/module/utils/EmojiReaction.js', () => ({
  EmojiReactionManager: class {
    event: { message_id?: string }

    constructor (event: { message_id?: string }) {
      this.event = event
    }
  }
}))

vi.mock('../../src/module/utils/ParseReactionAdapter.js', () => ({
  createEmojiParseReactionPort: (manager: { event: { message_id?: string } }) => ({
    setState: (state: string) => {
      const key = manager.event.message_id || 'unknown'
      const states = reactionStates.get(key) || []
      states.push(state)
      reactionStates.set(key, states)
    }
  })
}))

class PluginStub {}

(globalThis as unknown as { plugin: unknown }).plugin = PluginStub
globalThis.logger = {
  error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), mark: vi.fn()
} as unknown as typeof logger

const { kkkTools } = await import('../../src/apps/tools.js')

beforeEach(() => {
  vi.clearAllMocks()
  reactionStates.clear()
  wrapWithErrorHandlerMock.mockImplementation((fn: (...args: unknown[]) => unknown) => async (...args: unknown[]) => await fn(...args))
  getReplyMessageMock.mockImplementation(async (event: { msg?: string }) => event.msg || '')
  getDouyinIdMock.mockResolvedValue({ type: 'one_work', aweme_id: '7345' })
})

describe('kkkTools parse coordination', () => {
  it('runs one winner for duplicate URLs in the same group and reacts only on that event', async () => {
    let finishParse!: (value: boolean) => void
    douyinResourcesMock.mockImplementation(async () => await new Promise<boolean>(resolve => {
      finishParse = resolve
    }))
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    const firstEvent = {
      msg: 'https://www.douyin.com/video/7345?b=2&a=1#share',
      group_id: 10001,
      user_id: 1,
      message_id: 'winner',
      reply: vi.fn()
    } as never
    const duplicateEvent = {
      msg: 'https://www.douyin.com/video/7345?a=1&b=2',
      group_id: 10001,
      user_id: 2,
      message_id: 'duplicate',
      reply: vi.fn()
    } as never

    const first = tools.douyin(firstEvent)
    await vi.waitFor(() => expect(douyinResourcesMock).toHaveBeenCalledTimes(1))
    const duplicate = tools.douyin(duplicateEvent)
    await Promise.resolve()

    expect(getDouyinIdMock).toHaveBeenCalledTimes(1)
    expect(douyinResourcesMock).toHaveBeenCalledTimes(1)
    expect(reactionStates.get('winner')).toEqual(['processing'])
    expect(reactionStates.get('duplicate')).toBeUndefined()

    finishParse(true)
    await expect(Promise.all([first, duplicate])).resolves.toEqual([true, true])
    expect(reactionStates.get('winner')).toEqual(['processing', 'succeeded'])
    expect(reactionStates.get('duplicate')).toBeUndefined()
    expect(wrapWithErrorHandlerMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        emojiReaction: false,
        rethrowAfterHandle: true
      })
    )
  })

  it('coordinates duplicate raw Douyin media URLs before downloading', async () => {
    let finishDownload!: () => void
    downloadVideoMock.mockImplementation(async () => await new Promise<void>(resolve => {
      finishDownload = resolve
    }))
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    const firstEvent = {
      msg: 'https://aweme.snssdk.com/aweme/v1/play/?video_id=raw-1&foo=bar',
      group_id: 10001,
      user_id: 1,
      message_id: 'raw-winner',
      reply: vi.fn()
    } as never
    const duplicateEvent = {
      msg: 'https://aweme.snssdk.com/aweme/v1/play/?foo=bar&video_id=raw-1',
      group_id: 10001,
      user_id: 2,
      message_id: 'raw-duplicate',
      reply: vi.fn()
    } as never

    const first = tools.prefix(firstEvent)
    await vi.waitFor(() => expect(downloadVideoMock).toHaveBeenCalledTimes(1))
    const duplicate = tools.prefix(duplicateEvent)
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(downloadVideoMock).toHaveBeenCalledTimes(1)
    expect(reactionStates.get('raw-winner')).toEqual(['processing'])
    expect(reactionStates.get('raw-duplicate')).toBeUndefined()

    finishDownload()
    await expect(Promise.all([first, duplicate])).resolves.toEqual([true, true])
    expect(reactionStates.get('raw-winner')).toEqual(['processing', 'succeeded'])
    expect(reactionStates.get('raw-duplicate')).toBeUndefined()
  })
})
