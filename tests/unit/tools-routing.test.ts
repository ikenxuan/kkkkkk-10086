import { beforeEach, describe, expect, it, vi } from 'vitest'

const doubles = vi.hoisted(() => ({
  getKuaishouID: vi.fn(),
  getBilibiliID: vi.fn(),
  bilibiliResources: vi.fn(),
  kuaishouGetData: vi.fn(),
  kuaishouAction: vi.fn()
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Config: {
    app: { videoTool: true, videotool: true, defaulttool: false, priority: 500 },
    douyin: { switch: true, cookies: '', sendHDrecord: false },
    bilibili: { switch: true },
    kuaishou: { switch: true },
    xiaohongshu: { switch: true },
    cookies: { douyin: '' }
  },
  Common: { getReplyMessage: vi.fn() },
  UploadRecord: vi.fn(),
  wrapWithErrorHandler: (fn: (event: unknown) => unknown) => fn,
  downloadVideo: vi.fn(),
  baseHeaders: {}
}))

vi.mock('../../src/module/db/index.js', () => ({ getStatisticsDB: vi.fn().mockResolvedValue(null) }))
// 录制流水线整个挡掉：它的真实依赖链里有 FFmpeg / Base / bilibili 取流，
// 而那几个又要真的 Config（读宿主 lib/config），本文件只关心路由，不需要它们。
vi.mock('../../src/module/platform/common/liveRecord.js', () => ({ recordLiveRoom: vi.fn() }))
vi.mock('../../src/module/platform/douyin/api.js', () => ({ getDouyinData: vi.fn() }))
vi.mock('../../src/module/platform/douyin/index.js', () => ({
  DouYin: class {},
  getDouyinID: vi.fn()
}))
vi.mock('../../src/module/platform/xiaohongshu/index.js', () => ({
  Xiaohongshu: class {},
  getXiaohongshuID: vi.fn()
}))
vi.mock('../../src/module/platform/kuaishou/index.js', () => ({
  GetKuaishouID: doubles.getKuaishouID,
  KuaishouData: class {
    async GetData (payload: unknown): Promise<unknown> {
      return await doubles.kuaishouGetData(payload)
    }
  },
  KuaiShou: class {
    async Action (payload: unknown): Promise<boolean> {
      await doubles.kuaishouAction(payload)
      return true
    }
  }
}))
vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  getBilibiliID: doubles.getBilibiliID,
  Bilibili: class {
    constructor (event: unknown, data: unknown, options?: unknown) {
      doubles.bilibiliResources('constructor', event, data, options)
    }

    async RESOURCES (data: unknown): Promise<boolean> {
      doubles.bilibiliResources('resources', data)
      return true
    }
  }
}))

class PluginDouble {
  constructor (options: Record<string, unknown> = {}) {
    Object.assign(this, options)
  }
}

Object.assign(globalThis, { plugin: PluginDouble as unknown as typeof plugin })
globalThis.logger = {
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), mark: vi.fn()
} as unknown as typeof logger

const { kkkTools: KkkTools } = await import('../../src/apps/tools.js')

describe('tools 平台路由回归', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    doubles.kuaishouGetData.mockResolvedValue({ VideoData: {}, CommentData: {}, EmojiData: {} })
    doubles.getKuaishouID.mockResolvedValue({ type: 'one_work', photoId: 'photo-1', P: '快手' })
    doubles.getBilibiliID.mockResolvedValue({ type: 'video', bvid: 'BV1xx411c7mD' })
  })

  it('把消息中的单个快手 URL 字符串交给 ID 解析器', async () => {
    const app = new KkkTools()
    const event = {
      msg: '看看这个 https://v.kuaishou.com/AbC123 复制打开',
      group_id: 100,
      user_id: 200,
      reply: vi.fn()
    }

    await app._kuaishou(event)

    expect(doubles.getKuaishouID).toHaveBeenCalledWith('https://v.kuaishou.com/AbC123')
  })

  it('按群和用户保存 B 站解析状态并用它选择剧集', async () => {
    const app = new KkkTools()
    const parseEvent = {
      msg: 'https://www.bilibili.com/video/BV1xx411c7mD',
      group_id: 100,
      user_id: 200,
      reply: vi.fn()
    }
    await app._bilibili(parseEvent)
    doubles.bilibiliResources.mockClear()

    await app.next({ ...parseEvent, msg: '#第12集' })

    expect(doubles.bilibiliResources).toHaveBeenNthCalledWith(
      1,
      'constructor',
      expect.objectContaining({ group_id: 100, user_id: 200 }),
      { type: 'video', bvid: 'BV1xx411c7mD', Episode: '12' },
      undefined
    )
    expect(doubles.bilibiliResources).toHaveBeenNthCalledWith(
      2,
      'resources',
      { type: 'video', bvid: 'BV1xx411c7mD', Episode: '12' }
    )
  })

  /**
   * BGM 规则必须锚在行首。
   *
   * 「默认解析」开启时本 app 的 priority 是 -Infinity，比所有插件先拿到消息；
   * 而 uploadRecord 不认的输入不会 `return false` 交还派发权，会直接回一句
   * 「获取音乐数据失败」。所以少了 `^`，别的插件里任何带 `BGM<数字>` 的命令
   * 都会被这里截走并收到那句报错。
   */
  it('BGM 规则只吃行首，不截走正文里带 BGM 编号的别家命令', () => {
    const app = new KkkTools() as unknown as { rule: Array<{ reg: RegExp, fnc: string }> }
    const bgmRule = app.rule.find(item => item.fnc === 'uploadRecord')

    expect(bgmRule).toBeDefined()
    expect(bgmRule!.reg.test('#BGM123')).toBe(true)
    expect(bgmRule!.reg.test('BGM123')).toBe(true)
    expect(bgmRule!.reg.test('#别家命令 BGM123')).toBe(false)
    expect(bgmRule!.reg.test('这首歌的 BGM123 是什么')).toBe(false)
  })
})
