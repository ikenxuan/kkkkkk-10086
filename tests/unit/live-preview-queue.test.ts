import { beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.logger = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mark: vi.fn(),
  warn: vi.fn()
} as unknown as typeof logger

/** 落盘替身：行为对齐 `db/livePreview.ts` 的四个方法，包括那条 UNIQUE 去重 */
const rows = vi.hoisted(() => [] as Record<string, string>[])
const fakeDB = vi.hoisted(() => ({
  enqueue: vi.fn(async (ticket: Record<string, string>) => {
    const key = `${ticket.selfId}:${ticket.sessionType}:${ticket.sessionId}:${ticket.roomKey}`
    if (rows.some(row => `${row.selfId}:${row.sessionType}:${row.sessionId}:${row.roomKey}` === key)) return
    rows.push({ ...ticket })
  }),
  subscribers: vi.fn(async (roomKey: string) => rows.filter(row => row.roomKey === roomKey)),
  pending: vi.fn(async () => [...rows]),
  release: vi.fn(async (roomKey: string) => {
    const before = rows.length
    for (let index = rows.length - 1; index >= 0; index--) {
      if (rows[index]!.roomKey === roomKey) rows.splice(index, 1)
    }
    return before - rows.length
  })
}))

vi.mock('../../src/module/db/index.js', () => ({
  getLivePreviewDB: async () => fakeDB
}))

const resolveLiveSource = vi.hoisted(() => vi.fn())
vi.mock('../../src/module/platform/common/liveRecord.js', () => ({ resolveLiveSource }))

const recordLiveStream = vi.hoisted(() => vi.fn())
vi.mock('../../src/module/utils/FFmpeg.js', () => ({ recordLiveStream }))

const uploadFile = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../../src/module/utils/index.js', () => ({
  Common: {
    mkdir: vi.fn(async () => true),
    tempDri: { video: '/tmp/video/' },
    getVideoFileSize: vi.fn(async () => 3.2),
    removeFile: vi.fn(async () => true)
  },
  sanitizeFilenameSegment: (value: string) => value,
  uploadFile
}))

vi.mock('../../src/module/utils/media-metrics.js', () => ({
  fromMilliseconds: (value: number) => value,
  reportMedia: vi.fn()
}))

const {
  __awaitLivePreviewIdle,
  __resetLivePreviewQueue,
  enqueueLivePreview,
  livePreviewRoomKey,
  restoreLivePreviewQueue
} = await import('../../src/module/platform/common/livePreview.js')

/** 一个够用的事件替身：会话三件套 + reply */
const event = (options: { selfId?: string, groupId?: string, userId?: string } = {}) => ({
  self_id: options.selfId ?? '10001',
  ...(options.groupId === undefined ? { group_id: '999' } : { group_id: options.groupId }),
  ...(options.userId ? { user_id: options.userId } : {}),
  reply: vi.fn(async () => true)
})

/** 让取流成功并让录制真的产出字节 */
const arrangeSuccess = (): void => {
  resolveLiveSource.mockResolvedValue({
    ok: true,
    source: { url: 'https://pull.example.com/live.flv', qualityName: '高清', suffix: 'flv', name: '房间', title: '标题' }
  })
  recordLiveStream.mockResolvedValue({ success: true, filePath: '/tmp/video/a.flv', durationMs: 15000, bytes: 3355443 })
}

beforeEach(() => {
  rows.length = 0
  __resetLivePreviewQueue()
  vi.clearAllMocks()
  uploadFile.mockResolvedValue(true)
})

describe('livePreviewRoomKey', () => {
  // 抖音 web_rid 和B站房间号都是纯数字，不带平台前缀会把两个平台的同号房间当成同一个
  it('带平台前缀', () => {
    expect(livePreviewRoomKey('douyin', '123456')).toBe('douyin:123456')
    expect(livePreviewRoomKey('bilibili', 123456)).toBe('bilibili:123456')
    expect(livePreviewRoomKey('douyin', '1')).not.toBe(livePreviewRoomKey('bilibili', '1'))
  })
})

describe('enqueueLivePreview 录制与发送', () => {
  it('录成功后先发一句说明再发文件', async () => {
    arrangeSuccess()
    const e = event()

    await enqueueLivePreview(e as never, 'douyin', '123456', 'https://live.douyin.com/123456')
    await __awaitLivePreviewIdle()

    expect(recordLiveStream).toHaveBeenCalledTimes(1)
    // 15 秒硬编码，不跟 live.maxDuration 走
    expect(recordLiveStream.mock.calls[0]![0].maxDurationMs).toBe(15000)
    expect(e.reply).toHaveBeenCalledWith('刚才那个直播间的 15 秒预览')
    expect(uploadFile).toHaveBeenCalledTimes(1)
  })

  // 预览走固定中档，不跟用户配的录制画质
  it('取流用的是预览专用画质', async () => {
    arrangeSuccess()

    await enqueueLivePreview(event() as never, 'douyin', '123456', 'https://live.douyin.com/123456')
    await __awaitLivePreviewIdle()

    expect(resolveLiveSource).toHaveBeenCalledWith(
      'douyin',
      'https://live.douyin.com/123456',
      { douyinQuality: 'SD1', bilibiliQn: 250 }
    )
  })

  /*
    全程静默是设计：这条路径不是用户主动要的，关播、拿不到地址、一个字节没录到
    都不该在群里冒一条消息出来。
  */
  it('取流失败时一句话都不发', async () => {
    resolveLiveSource.mockResolvedValue({ ok: false, message: '未开播' })
    const e = event()

    await enqueueLivePreview(e as never, 'douyin', '123456', 'https://live.douyin.com/123456')
    await __awaitLivePreviewIdle()

    expect(recordLiveStream).not.toHaveBeenCalled()
    expect(e.reply).not.toHaveBeenCalled()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('一个字节都没录到时也不发', async () => {
    resolveLiveSource.mockResolvedValue({
      ok: true,
      source: { url: 'https://pull.example.com/live.flv', qualityName: '高清', suffix: 'flv', name: '房间', title: '' }
    })
    recordLiveStream.mockResolvedValue({ success: false, filePath: '/tmp/video/a.flv', durationMs: 0, bytes: 0 })
    const e = event()

    await enqueueLivePreview(e as never, 'douyin', '123456', 'https://live.douyin.com/123456')
    await __awaitLivePreviewIdle()

    expect(e.reply).not.toHaveBeenCalled()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  // 一项失败不该让后面排着的项跟着不跑
  it('一项抛异常不影响下一项', async () => {
    resolveLiveSource
      .mockRejectedValueOnce(new Error('取数炸了'))
      .mockResolvedValue({
        ok: true,
        source: { url: 'https://pull.example.com/live.flv', qualityName: '高清', suffix: 'flv', name: '房间', title: '' }
      })
    recordLiveStream.mockResolvedValue({ success: true, filePath: '/tmp/video/a.flv', durationMs: 15000, bytes: 100 })

    await enqueueLivePreview(event() as never, 'douyin', '111', 'https://live.douyin.com/111')
    await enqueueLivePreview(event() as never, 'douyin', '222', 'https://live.douyin.com/222')
    await __awaitLivePreviewIdle()

    expect(recordLiveStream).toHaveBeenCalledTimes(1)
    // 成败都要放掉账本，否则失败那项会在下次重启时又试一遍
    expect(rows).toEqual([])
  })
})

describe('enqueueLivePreview 去重与并发', () => {
  it('同一个房间只录一次，但发给所有订阅者', async () => {
    arrangeSuccess()
    const first = event({ groupId: '999' })
    const second = event({ groupId: '888' })

    // 不 await 第一个：模拟两条消息几乎同时到达，第二个要落进同一项的订阅名单
    const pending = enqueueLivePreview(first as never, 'douyin', '123456', 'https://live.douyin.com/123456')
    await enqueueLivePreview(second as never, 'douyin', '123456', 'https://live.douyin.com/123456')
    await pending
    await __awaitLivePreviewIdle()

    expect(recordLiveStream).toHaveBeenCalledTimes(1)
    expect(first.reply).toHaveBeenCalledTimes(1)
    expect(second.reply).toHaveBeenCalledTimes(1)
    expect(uploadFile).toHaveBeenCalledTimes(2)
  })

  // 同一个会话把同一条链接连转三次，只该有一个订阅者、一次发送
  it('同一个会话重复转同一房间只发一次', async () => {
    arrangeSuccess()
    const e = event()

    const pending = enqueueLivePreview(e as never, 'douyin', '123456', 'https://live.douyin.com/123456')
    await enqueueLivePreview(e as never, 'douyin', '123456', 'https://live.douyin.com/123456')
    await pending
    await __awaitLivePreviewIdle()

    expect(recordLiveStream).toHaveBeenCalledTimes(1)
    expect(uploadFile).toHaveBeenCalledTimes(1)
  })

  /*
    全局并发 1：ffmpeg 多路并行是真吃带宽和 CPU，而这条路径每条直播链接都会触发。
    判据是「任一时刻只有一个 recordLiveStream 在飞」，不是数总次数。
  */
  it('录制串行，不会两路同时在跑', async () => {
    resolveLiveSource.mockResolvedValue({
      ok: true,
      source: { url: 'https://pull.example.com/live.flv', qualityName: '高清', suffix: 'flv', name: '房间', title: '' }
    })
    let inFlight = 0
    let maxInFlight = 0
    recordLiveStream.mockImplementation(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Promise.resolve()
      inFlight--
      return { success: true, filePath: '/tmp/video/a.flv', durationMs: 15000, bytes: 100 }
    })

    await Promise.all([
      enqueueLivePreview(event() as never, 'douyin', '111', 'https://live.douyin.com/111'),
      enqueueLivePreview(event() as never, 'douyin', '222', 'https://live.douyin.com/222'),
      enqueueLivePreview(event() as never, 'douyin', '333', 'https://live.douyin.com/333')
    ])
    await __awaitLivePreviewIdle()

    expect(recordLiveStream).toHaveBeenCalledTimes(3)
    expect(maxInFlight).toBe(1)
  })

  /*
    深度上限只拦「新房间」：满了之后再有人转已经在队里的房间，只是名单加一行，
    不多一次录制，没有理由拒绝。
  */
  it('队列满了丢新房间，但已在队里的房间仍能加订阅者', async () => {
    resolveLiveSource.mockResolvedValue({ ok: false, message: '未开播' })
    // 消费循环卡住，队列才堆得起来
    let unblock = (): void => {}
    const blocked = new Promise<void>(resolve => { unblock = resolve })
    resolveLiveSource.mockImplementationOnce(async () => {
      await blocked
      return { ok: false, message: '未开播' }
    })

    const first = enqueueLivePreview(event() as never, 'douyin', 'room-0', 'https://live.douyin.com/room-0')
    for (let index = 1; index <= 25; index++) {
      await enqueueLivePreview(event() as never, 'douyin', `room-${index}`, `https://live.douyin.com/room-${index}`)
    }
    // 第 21 个之后的新房间被丢掉：账本里只有上限内的那些
    const distinctRooms = new Set(rows.map(row => row.roomKey))
    expect(distinctRooms.size).toBeLessThanOrEqual(21)

    // 已在队里的房间再来一个会话，照样记进名单
    await enqueueLivePreview(event({ groupId: '888' }) as never, 'douyin', 'room-5', 'https://live.douyin.com/room-5')
    expect(rows.filter(row => row.roomKey === 'douyin:room-5')).toHaveLength(2)

    unblock()
    await first
    await __awaitLivePreviewIdle()
  })
})

describe('restoreLivePreviewQueue', () => {
  beforeEach(() => {
    globalThis.segment = { video: (path: string) => ({ type: 'video', file: path }) } as never
  })

  /** 造一个能被 pickGroup / pickFriend 取到会话的 bot 替身 */
  const arrangeBot = (): { group: ReturnType<typeof vi.fn>, friend: ReturnType<typeof vi.fn> } => {
    const group = vi.fn(async () => true)
    const friend = vi.fn(async () => true)
    globalThis.Bot = {
      10001: {
        pickGroup: () => ({ sendMsg: group }),
        pickFriend: () => ({ sendMsg: friend })
      }
    } as never
    return { group, friend }
  }

  it('把账本里剩下的房间重新排队并录出来', async () => {
    arrangeSuccess()
    const { group } = arrangeBot()
    rows.push({
      selfId: '10001',
      sessionType: 'group',
      sessionId: '999',
      platform: 'douyin',
      roomKey: 'douyin:123456',
      roomUrl: 'https://live.douyin.com/123456'
    })

    expect(await restoreLivePreviewQueue()).toBe(1)
    await __awaitLivePreviewIdle()

    expect(recordLiveStream).toHaveBeenCalledTimes(1)
    // 恢复出来的项没有事件对象，只能走主动发送：一句说明 + 一段视频
    expect(group).toHaveBeenCalledTimes(2)
    expect(group.mock.calls[0]![0]).toBe('刚才那个直播间的 15 秒预览')
    expect(rows).toEqual([])
  })

  it('私聊那条走 pickFriend', async () => {
    arrangeSuccess()
    const { group, friend } = arrangeBot()
    rows.push({
      selfId: '10001',
      sessionType: 'private',
      sessionId: '777',
      platform: 'bilibili',
      roomKey: 'bilibili:654',
      roomUrl: 'https://live.bilibili.com/654'
    })

    await restoreLivePreviewQueue()
    await __awaitLivePreviewIdle()

    expect(friend).toHaveBeenCalledTimes(2)
    expect(group).not.toHaveBeenCalled()
  })

  // 多 bot 实例在线时用别的实例发消息是串台，取不到就该跳过而不是随便找一个
  it('找不到对应 self_id 的 bot 实例时跳过补发', async () => {
    arrangeSuccess()
    arrangeBot()
    rows.push({
      selfId: '20002',
      sessionType: 'group',
      sessionId: '999',
      platform: 'douyin',
      roomKey: 'douyin:123456',
      roomUrl: 'https://live.douyin.com/123456'
    })

    await restoreLivePreviewQueue()
    await __awaitLivePreviewIdle()

    // 录了，但没发出去；账本照样放掉，不留给下次重启再试
    expect(recordLiveStream).toHaveBeenCalledTimes(1)
    expect(rows).toEqual([])
  })

  it('账本为空时不启动任何录制', async () => {
    arrangeSuccess()
    arrangeBot()

    expect(await restoreLivePreviewQueue()).toBe(0)
    await __awaitLivePreviewIdle()

    expect(recordLiveStream).not.toHaveBeenCalled()
  })

  // 同一个房间的多个订阅者在账本里是多行，但只该录一次
  it('同房间的多行只排一项', async () => {
    arrangeSuccess()
    const { group } = arrangeBot()
    for (const sessionId of ['999', '888']) {
      rows.push({
        selfId: '10001',
        sessionType: 'group',
        sessionId,
        platform: 'douyin',
        roomKey: 'douyin:123456',
        roomUrl: 'https://live.douyin.com/123456'
      })
    }

    expect(await restoreLivePreviewQueue()).toBe(1)
    await __awaitLivePreviewIdle()

    expect(recordLiveStream).toHaveBeenCalledTimes(1)
    // 两个会话各收到「说明 + 视频」
    expect(group).toHaveBeenCalledTimes(4)
  })
})
