import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ParseCoordinator,
  createParseFingerprint,
  type ParseJobIdentity,
  type ParseReactionPort
} from '../../src/module/utils/ParseCoordinator.js'
import type { ParseTask } from '../../src/module/utils/ParseScheduler.js'

const getDouyinIdMock = vi.hoisted(() => vi.fn())
const douyinResourcesMock = vi.hoisted(() => vi.fn())
const getBilibiliIdMock = vi.hoisted(() => vi.fn())
const bilibiliResourcesMock = vi.hoisted(() => vi.fn())
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
  getBilibiliID: getBilibiliIdMock,
  Bilibili: class {
    RESOURCES = bilibiliResourcesMock
  }
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
  getStatisticsDB: async () => ({ recordParse: recordParseMock }),
  PRIVATE_GROUP_ID: 'private'
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

/**
 * tools.ts 里的 parseCoordinator 是模块级单例，测试拿不到它的实例，
 * 也就没法直接读它收到的指纹身份。这里在原型上挂一个透传 spy：真实的 submit
 * 照常执行（并发队列 / 去重 / 表情回应全部保留），顺手把 identity 记下来，
 * 这样「显式 work-id 目标算出什么指纹」才能被断言，而不是只能看副作用。
 */
const submittedIdentities: ParseJobIdentity[] = []
const realSubmit = ParseCoordinator.prototype.submit

vi.spyOn(ParseCoordinator.prototype, 'submit').mockImplementation(function (
  this: ParseCoordinator,
  identity: ParseJobIdentity,
  task: ParseTask<unknown>,
  reaction?: ParseReactionPort
) {
  submittedIdentities.push(identity)
  return realSubmit.call(this, identity, task, reaction)
})

beforeEach(() => {
  vi.clearAllMocks()
  reactionStates.clear()
  submittedIdentities.length = 0
  wrapWithErrorHandlerMock.mockImplementation((fn: (...args: unknown[]) => unknown) => async (...args: unknown[]) => await fn(...args))
  getReplyMessageMock.mockImplementation(async (event: { msg?: string }) => event.msg || '')
  getDouyinIdMock.mockResolvedValue({ type: 'one_work', aweme_id: '7345' })
  douyinResourcesMock.mockReset()
  bilibiliResourcesMock.mockReset()
  getBilibiliIdMock.mockReset()
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

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

const createDeferred = <T>(): Deferred<T> => {
  let resolveDeferred!: (value: T) => void
  const promise = new Promise<T>(resolve => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

const createEvent = (overrides: {
  msg: string
  user_id: number
  message_id: string
  group_id?: number
}): never => ({
  reply: vi.fn(),
  ...overrides
}) as never

const fingerprintsOf = (identities: readonly ParseJobIdentity[]): string[] =>
  identities.map(identity => createParseFingerprint(identity))

describe('kkkTools bilibili episode selection coordination', () => {
  /**
   * 先跑一次正常的B站解析，把 getBilibiliID 的结果存进选集表，
   * 之后回复集号才有 stored 可用。
   */
  const primeBilibiliSelection = async (
    tools: InstanceType<typeof kkkTools>,
    event: never,
    idData: Record<string, unknown>
  ): Promise<void> => {
    getBilibiliIdMock.mockResolvedValueOnce(idData)
    bilibiliResourcesMock.mockResolvedValueOnce(true)
    await tools.bilibili(event)
  }

  it('给不同番剧的同一集号算出不同指纹，同群两个人不会被错误去重', async () => {
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    await primeBilibiliSelection(
      tools,
      createEvent({ msg: 'https://www.bilibili.com/bangumi/play/ep1001', group_id: 10001, user_id: 1, message_id: 'prime-a' }),
      { type: 'bangumi_video_info', isEpid: true, realid: 'ep1001' }
    )
    await primeBilibiliSelection(
      tools,
      createEvent({ msg: 'https://www.bilibili.com/bangumi/play/ep2002', group_id: 10001, user_id: 2, message_id: 'prime-b' }),
      { type: 'bangumi_video_info', isEpid: true, realid: 'ep2002' }
    )

    submittedIdentities.length = 0
    reactionStates.clear()
    // 预热那几次解析也走了协调器、也调过 RESOURCES，计数器必须清掉，
    // 否则下面的断言会把预热次数算进选集入口。
    bilibiliResourcesMock.mockClear()
    const gate = createDeferred<boolean>()
    bilibiliResourcesMock.mockImplementation(async () => await gate.promise)

    // 两个人发的消息文本一模一样。从 e.msg 反推目标的话两边指纹相同、会被去重成
    // 一个任务，其中一个人拿到另一个番剧的结果 —— 这是本用例守的回归。
    const first = tools.next(createEvent({ msg: '第1集', group_id: 10001, user_id: 1, message_id: 'pick-a' }))
    const second = tools.next(createEvent({ msg: '第1集', group_id: 10001, user_id: 2, message_id: 'pick-b' }))

    await vi.waitFor(() => expect(bilibiliResourcesMock).toHaveBeenCalledTimes(2))
    expect(submittedIdentities).toHaveLength(2)
    const [firstFingerprint, secondFingerprint] = fingerprintsOf(submittedIdentities)
    expect(firstFingerprint).not.toBe(secondFingerprint)
    expect(submittedIdentities[0]?.target.value).toContain('ep1001')
    expect(submittedIdentities[1]?.target.value).toContain('ep2002')
    expect(submittedIdentities.map(identity => identity.scope)).toEqual([
      { type: 'group', id: '10001' },
      { type: 'group', id: '10001' }
    ])

    gate.resolve(true)
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    expect(reactionStates.get('pick-a')).toEqual(['processing', 'succeeded'])
    expect(reactionStates.get('pick-b')).toEqual(['processing', 'succeeded'])
  })

  it('同一个选集并发点两次只跑一遍 handler，且两次指纹一致', async () => {
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    await primeBilibiliSelection(
      tools,
      createEvent({ msg: 'https://www.bilibili.com/bangumi/play/ep3003', group_id: 10002, user_id: 7, message_id: 'prime-dedup' }),
      { type: 'bangumi_video_info', isEpid: true, realid: 'ep3003' }
    )

    submittedIdentities.length = 0
    reactionStates.clear()
    // 预热那几次解析也走了协调器、也调过 RESOURCES，计数器必须清掉，
    // 否则下面的断言会把预热次数算进选集入口。
    bilibiliResourcesMock.mockClear()
    const gate = createDeferred<boolean>()
    bilibiliResourcesMock.mockImplementation(async () => await gate.promise)

    const winner = tools.next(createEvent({ msg: '第2集', group_id: 10002, user_id: 7, message_id: 'ep-winner' }))
    await vi.waitFor(() => expect(bilibiliResourcesMock).toHaveBeenCalledTimes(1))
    const duplicate = tools.next(createEvent({ msg: '第2集', group_id: 10002, user_id: 7, message_id: 'ep-duplicate' }))
    await Promise.resolve()

    expect(bilibiliResourcesMock).toHaveBeenCalledTimes(1)
    expect(submittedIdentities).toHaveLength(2)
    const [winnerFingerprint, duplicateFingerprint] = fingerprintsOf(submittedIdentities)
    expect(winnerFingerprint).toBe(duplicateFingerprint)
    expect(reactionStates.get('ep-winner')).toEqual(['processing'])
    expect(reactionStates.get('ep-duplicate')).toBeUndefined()

    gate.resolve(true)
    await expect(Promise.all([winner, duplicate])).resolves.toEqual([true, true])
    expect(reactionStates.get('ep-winner')).toEqual(['processing', 'succeeded'])
    expect(reactionStates.get('ep-duplicate')).toBeUndefined()
  })

  it('区分群聊和私聊作用域：同一番剧同一集在两个作用域各跑一次', async () => {
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    await primeBilibiliSelection(
      tools,
      createEvent({ msg: 'https://www.bilibili.com/bangumi/play/ep4004', group_id: 10003, user_id: 9, message_id: 'prime-group' }),
      { type: 'bangumi_video_info', isEpid: true, realid: 'ep4004' }
    )
    await primeBilibiliSelection(
      tools,
      createEvent({ msg: 'https://www.bilibili.com/bangumi/play/ep4004?from=dm', user_id: 9, message_id: 'prime-private' }),
      { type: 'bangumi_video_info', isEpid: true, realid: 'ep4004' }
    )

    submittedIdentities.length = 0
    bilibiliResourcesMock.mockClear()
    const gate = createDeferred<boolean>()
    bilibiliResourcesMock.mockImplementation(async () => await gate.promise)

    const inGroup = tools.next(createEvent({ msg: '第5集', group_id: 10003, user_id: 9, message_id: 'scope-group' }))
    const inPrivate = tools.next(createEvent({ msg: '第5集', user_id: 9, message_id: 'scope-private' }))

    await vi.waitFor(() => expect(bilibiliResourcesMock).toHaveBeenCalledTimes(2))
    expect(submittedIdentities.map(identity => identity.scope)).toEqual([
      { type: 'group', id: '10003' },
      { type: 'private', id: '9' }
    ])
    // 目标完全相同，只有作用域把两者分开。
    expect(submittedIdentities[0]?.target).toEqual(submittedIdentities[1]?.target)
    const [groupFingerprint, privateFingerprint] = fingerprintsOf(submittedIdentities)
    expect(groupFingerprint).not.toBe(privateFingerprint)

    gate.resolve(true)
    await expect(Promise.all([inGroup, inPrivate])).resolves.toEqual([true, true])
  })

  it('显式目标是非空 work-id，同一输入指纹稳定，空值被指纹构造拒绝', async () => {
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    await primeBilibiliSelection(
      tools,
      createEvent({ msg: 'https://www.bilibili.com/bangumi/play/ep5005', group_id: 10004, user_id: 3, message_id: 'prime-stable' }),
      { type: 'bangumi_video_info', isEpid: true, realid: 'ep5005' }
    )

    submittedIdentities.length = 0
    bilibiliResourcesMock.mockClear()
    bilibiliResourcesMock.mockResolvedValue(true)
    // 串行跑两次同一个选集：pending 表已清空，两次都真的执行，指纹必须照样一致。
    await expect(tools.next(createEvent({ msg: '第1集', group_id: 10004, user_id: 3, message_id: 'stable-1' }))).resolves.toBe(true)
    await expect(tools.next(createEvent({ msg: '第1集', group_id: 10004, user_id: 3, message_id: 'stable-2' }))).resolves.toBe(true)

    expect(bilibiliResourcesMock).toHaveBeenCalledTimes(2)
    expect(submittedIdentities).toHaveLength(2)
    const [firstFingerprint, secondFingerprint] = fingerprintsOf(submittedIdentities)
    expect(firstFingerprint).toBe(secondFingerprint)
    expect(firstFingerprint).toMatch(/^parse:v1:/)

    const identity = submittedIdentities[0] as ParseJobIdentity
    expect(identity.target.type).toBe('work-id')
    expect(identity.target.value.trim()).not.toBe('')
    expect(() => createParseFingerprint({
      ...identity,
      target: { type: 'work-id', value: '' }
    })).toThrow(TypeError)
  })
})

describe('kkkTools douyin work selection coordination', () => {
  /** 先跑一次主页解析，让 RESOURCES 返回选择列表，把候选作品存进选集表 */
  const primeDouyinSelection = async (
    tools: InstanceType<typeof kkkTools>,
    event: never,
    awemeIds: readonly string[]
  ): Promise<void> => {
    douyinResourcesMock.mockResolvedValueOnce({
      type: 'douyin_user_selection',
      timeoutSeconds: 60,
      videos: awemeIds.map(aweme_id => ({ aweme_id }))
    })
    await tools.douyin(event)
  }

  it('用真实 aweme_id 作指纹：同群两人回同一个序号但选的不是同一个作品，各跑一次', async () => {
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    await primeDouyinSelection(
      tools,
      createEvent({ msg: 'https://www.douyin.com/user/aaa', group_id: 20001, user_id: 1, message_id: 'dy-prime-a' }),
      ['111', '222']
    )
    await primeDouyinSelection(
      tools,
      createEvent({ msg: 'https://www.douyin.com/user/bbb', group_id: 20001, user_id: 2, message_id: 'dy-prime-b' }),
      ['333', '444']
    )

    submittedIdentities.length = 0
    reactionStates.clear()
    douyinResourcesMock.mockClear()
    const gate = createDeferred<boolean>()
    douyinResourcesMock.mockImplementation(async () => await gate.promise)

    // 两人都回「1」。从 e.msg 反推目标会算出同一个指纹，其中一个人会拿到另一个人选的作品。
    const first = tools.selectDouyinWork(createEvent({ msg: '1', group_id: 20001, user_id: 1, message_id: 'dy-pick-a' }))
    const second = tools.selectDouyinWork(createEvent({ msg: '1', group_id: 20001, user_id: 2, message_id: 'dy-pick-b' }))

    await vi.waitFor(() => expect(douyinResourcesMock).toHaveBeenCalledTimes(2))
    expect(submittedIdentities.map(identity => identity.target)).toEqual([
      { type: 'work-id', value: '111' },
      { type: 'work-id', value: '333' }
    ])
    const [firstFingerprint, secondFingerprint] = fingerprintsOf(submittedIdentities)
    expect(firstFingerprint).not.toBe(secondFingerprint)

    gate.resolve(true)
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    // 表情回应是走协调器之后新拿到的能力；解析统计是原来就有、不能丢的。
    expect(reactionStates.get('dy-pick-a')).toEqual(['processing', 'succeeded'])
    expect(reactionStates.get('dy-pick-b')).toEqual(['processing', 'succeeded'])
    expect(recordParseMock).toHaveBeenCalledWith('20001', '1', 'douyin')
    expect(recordParseMock).toHaveBeenCalledWith('20001', '2', 'douyin')
  })

  it('同一个作品的重复提交只跑一遍 handler', async () => {
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    await primeDouyinSelection(
      tools,
      createEvent({ msg: 'https://www.douyin.com/user/ccc', group_id: 20002, user_id: 5, message_id: 'dy-prime-dedup' }),
      ['555', '666']
    )

    submittedIdentities.length = 0
    reactionStates.clear()
    douyinResourcesMock.mockClear()
    const gate = createDeferred<boolean>()
    douyinResourcesMock.mockImplementation(async () => await gate.promise)

    // selectDouyinWork 命中后会把选集表清掉，所以第二次点击走不到协调器；
    // 这里直接用同一个显式目标再提交一次，验证去重是按真实 aweme_id 生效的。
    const winner = tools.selectDouyinWork(createEvent({ msg: '2', group_id: 20002, user_id: 5, message_id: 'dy-winner' }))
    await vi.waitFor(() => expect(douyinResourcesMock).toHaveBeenCalledTimes(1))
    const duplicateHandler = vi.fn(async () => true)
    const duplicate = tools.runCoordinatedParse(
      createEvent({ msg: '2', group_id: 20002, user_id: 5, message_id: 'dy-duplicate' }),
      'douyin',
      '抖音主页作品选择解析',
      duplicateHandler,
      { type: 'work-id', value: '666' }
    )
    await Promise.resolve()

    expect(duplicateHandler).not.toHaveBeenCalled()
    expect(douyinResourcesMock).toHaveBeenCalledTimes(1)
    expect(submittedIdentities).toHaveLength(2)
    const [winnerFingerprint, duplicateFingerprint] = fingerprintsOf(submittedIdentities)
    expect(winnerFingerprint).toBe(duplicateFingerprint)
    expect(reactionStates.get('dy-winner')).toEqual(['processing'])
    expect(reactionStates.get('dy-duplicate')).toBeUndefined()

    gate.resolve(true)
    await expect(Promise.all([winner, duplicate])).resolves.toEqual([true, true])
  })
})

describe('kkkTools 指纹构造失败不再静默', () => {
  /*
    e.msg 为空时 getParseTarget 会一路落到 `{ type: 'work-id', value: '' }`，
    normalizeTarget 的非空校验就在指纹构造里抛 TypeError。这个异常谁都没处理过，
    以前它掉进 runCoordinatedParse 末尾那个「吞掉业务异常」的 catch 里，
    表现成解析静默跳过、连一行日志都没有。
  */
  it('e.msg 为空时记一条 error 日志，且不进并发队列、不跑 handler', async () => {
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    bilibiliResourcesMock.mockResolvedValue(true)

    await expect(
      tools.bilibili(createEvent({ msg: '', group_id: 30001, user_id: 7, message_id: 'blank-msg' }))
    ).resolves.toBe(true)

    // 没进队列：submit 一次都没被调用，所以也不占并发额度、不产生表情回应。
    expect(submittedIdentities).toHaveLength(0)
    expect(reactionStates.get('blank-msg')).toBeUndefined()
    // 更重要的是 handler 根本没跑 —— 校验前移到了进队列之前。
    expect(getBilibiliIdMock).not.toHaveBeenCalled()
    expect(bilibiliResourcesMock).not.toHaveBeenCalled()

    // 唯一的排查线索必须真的留下来，而且带上平台和业务名。
    const errorMock = globalThis.logger.error as unknown as ReturnType<typeof vi.fn>
    expect(errorMock).toHaveBeenCalledTimes(1)
    const [message, cause] = errorMock.mock.calls[0] as [string, unknown]
    expect(message).toContain('bilibili')
    expect(message).toContain('B站视频解析')
    expect(cause).toBeInstanceOf(TypeError)
  })

  it('目标正常时不会误报，照旧进队列并跑 handler', async () => {
    const tools = Reflect.construct(kkkTools, []) as InstanceType<typeof kkkTools>
    getBilibiliIdMock.mockResolvedValue({ type: 'one_video', bvid: 'BV1xx411c7mD' })
    bilibiliResourcesMock.mockResolvedValue(true)

    await expect(
      tools.bilibili(createEvent({ msg: 'BV1xx411c7mD', group_id: 30002, user_id: 8, message_id: 'ok-msg' }))
    ).resolves.toBe(true)

    expect(submittedIdentities).toHaveLength(1)
    expect(bilibiliResourcesMock).toHaveBeenCalledTimes(1)
    // 只断言「没报指纹构造失败」，不断言「一条 error 都没有」：
    // 正常路径上别处（统计落库等）也可能记 error，那与本用例无关，
    // 用全局计数会让这条测试因为无关改动而脆断。
    const errorMock = globalThis.logger.error as unknown as ReturnType<typeof vi.fn>
    const fingerprintErrors = errorMock.mock.calls
      .filter(call => String(call[0]).includes('解析指纹构造失败'))
    expect(fingerprintErrors).toHaveLength(0)
  })
})
