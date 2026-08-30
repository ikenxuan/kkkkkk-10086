import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getKuaishouIDMock = vi.hoisted(() => vi.fn())
const getKuaishouDataMock = vi.hoisted(() => vi.fn())
const kuaishouActionMock = vi.hoisted(() => vi.fn())
const getBilibiliIDMock = vi.hoisted(() => vi.fn())
const bilibiliResourcesMock = vi.hoisted(() => vi.fn())
const getStatisticsDBMock = vi.hoisted(() => vi.fn())
const getDouyinIDMock = vi.hoisted(() => vi.fn())
const douyinResourcesMock = vi.hoisted(() => vi.fn())

const config = vi.hoisted(() => ({
  app: { videoTool: true, defaulttool: false, priority: 500 },
  douyin: { switch: true, douyintool: true, sendHDrecord: false },
  bilibili: { switch: true, bilibilitool: true },
  kuaishou: { switch: true, kuaishoutool: true },
  xiaohongshu: { switch: true },
  cookies: { douyin: '' }
}))

/**
 * 录制流水线的替身。挡掉它有两个理由：真实模块的依赖链（FFmpeg / Base / bilibili 取流）
 * 会绕过下面那个 utils barrel 替身去要真的 Config（那要读宿主 lib/config），
 * 而本文件要断言的是 `recordLive` **怎么派发** —— 平台判对没判对、URL 抽没抽干净。
 */
const recordLiveRoomMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/platform/common/liveRecord.js', () => ({
  recordLiveRoom: recordLiveRoomMock
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
  DouYin: vi.fn(function () { return { RESOURCES: douyinResourcesMock } }),
  getDouyinID: getDouyinIDMock
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

/** 按 fnc 取出注册的规则；顺序也是契约的一部分，所以连下标一起给出来 */
const findRule = (fnc: string): { reg: RegExp, fnc: string, index: number } => {
  const rules = (new ToolsApp() as unknown as { rule: Array<{ reg: RegExp, fnc: string }> }).rule
  const index = rules.findIndex(item => item.fnc === fnc)
  if (index < 0) throw new Error(`未注册 ${fnc} 规则`)
  return { ...rules[index]!, index }
}

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
  getDouyinIDMock.mockReset()
  douyinResourcesMock.mockReset()
  getDouyinIDMock.mockResolvedValue({ type: 'live_room_detail', room_id: '26139686' })
  douyinResourcesMock.mockResolvedValue(true)
  recordLiveRoomMock.mockReset()
  recordLiveRoomMock.mockResolvedValue(true)
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

/**
 * 两个真实样本链接的回归。
 *
 * 网关正则、URL 抽取正则、ID 提取三段都在同一条链路上，任一段漏掉 `live.` 子域
 * 都会表现成「发了链接机器人不吭声」，而单测只看其中一段是查不出来的。
 */
describe('kkkTools 直播间链接样本', () => {
  it('抖音网关放行直播间长链与 App 分享的 reflow 链接', () => {
    const { reg } = findRule('douyin')

    expect(reg.test('https://live.douyin.com/26139686')).toBe(true)
    expect(reg.test('https://webcast.amemv.com/douyin/webcast/reflow/7679333717948517135?sec_user_id=MS4wLjABAAAA')).toBe(true)
    // 短链本来就能过网关，断点在重定向解析之后
    expect(reg.test('https://v.douyin.com/McTw78sT5g0/')).toBe(true)
  })

  it('抖音直播间长链带 query 时仍能抽出 URL 交给 ID 解析器', async () => {
    const event = { ...createEvent('user-live'), msg: '快来看 https://live.douyin.com/26139686?unique_k=2333 复制打开抖音' }

    await new ToolsApp()._douyin(event)

    expect(getDouyinIDMock).toHaveBeenCalledWith('https://live.douyin.com/26139686?unique_k=2333')
    expect(douyinResourcesMock).toHaveBeenCalledTimes(1)
  })

  it('B站网关放行直播间链接，且清洗后保留完整地址', async () => {
    expect(findRule('bilibili').reg.test('https://live.bilibili.com/26139686?unique_k=2333')).toBe(true)

    const event = { ...createEvent('user-bili'), msg: '看直播 https://live.bilibili.com/26139686?unique_k=2333 来呀' }
    await new ToolsApp()._bilibili(event)

    expect(getBilibiliIDMock).toHaveBeenCalledWith('https://live.bilibili.com/26139686?unique_k=2333')
  })
})

/**
 * `#kkk录直播` 的规则与派发。
 *
 * 这条命令的形状比它看起来危险：命令正文里**自带一条平台链接**，而本 app 里那几条
 * 平台规则的正则是不锚定的（`/.*(live\.douyin\.com|…).*​/i`）。宿主按 `rule[]` 的
 * 数组顺序逐条试（lib/plugins/loader.js:283），且本 app 在「默认解析」开启时
 * priority 是 -Infinity，比所有插件都先拿到消息 —— 所以「排在第几位」是唯一的
 * 可达性开关，没有任何数值优先级能补救。
 */
describe('kkkTools 录直播规则', () => {
  it('规则排在所有平台规则之前，否则命令会被平台链接规则先吃掉', () => {
    const record = findRule('recordLive')

    expect(record.index).toBe(0)
    expect(record.index).toBeLessThan(findRule('douyin').index)
    expect(record.index).toBeLessThan(findRule('bilibili').index)
  })

  it('带不带 # 都认，井号后不留空格也认', () => {
    const { reg } = findRule('recordLive')

    expect(reg.test('#kkk录直播 https://live.douyin.com/26139686')).toBe(true)
    expect(reg.test('kkk录直播 https://live.bilibili.com/1017')).toBe(true)
    expect(reg.test('#kkk录直播https://live.douyin.com/26139686')).toBe(true)
  })

  it('只吃行首：正文里带这几个字的别家命令不会被截走', () => {
    const { reg } = findRule('recordLive')

    // 少了 `^` 的后果不是「多解析一次」，而是别的插件的命令被本 app 抢走并回错话
    expect(reg.test('帮我 #kkk录直播 一下')).toBe(false)
    expect(reg.test('这个功能叫 kkk录直播')).toBe(false)
  })

  it('关键字后紧跟汉字的更长命令不算本命令', () => {
    const { reg } = findRule('recordLive')

    // `prefix` 那条规则就是在这个形状上真实翻过车（`#kkk解析` 吃掉 `#kkk解析统计`）
    expect(reg.test('#kkk录直播列表')).toBe(false)
    expect(reg.test('#kkk录直播设置')).toBe(false)
  })

  it('裸链接不会被本规则截走，仍然走平台解析', () => {
    expect(findRule('recordLive').reg.test('https://live.douyin.com/26139686')).toBe(false)
    expect(findRule('douyin').reg.test('https://live.douyin.com/26139686')).toBe(true)
  })
})

describe('kkkTools 录直播派发', () => {
  it('抖音直播间链接按 douyin 平台录，URL 已剥掉末尾标点', async () => {
    const event = { ...createEvent('user-rec'), msg: '#kkk录直播 https://live.douyin.com/26139686。' }

    await expect(new ToolsApp().recordLive(event)).resolves.toBe(true)

    expect(recordLiveRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-rec' }),
      'douyin',
      'https://live.douyin.com/26139686'
    )
  })

  it('B站直播间链接按 bilibili 平台录', async () => {
    const event = { ...createEvent('user-rec'), msg: '#kkk录直播 https://live.bilibili.com/1017' }

    await new ToolsApp().recordLive(event)

    expect(recordLiveRoomMock).toHaveBeenCalledWith(
      expect.anything(),
      'bilibili',
      'https://live.bilibili.com/1017'
    )
  })

  it('没带链接时明确要链接，不进队列', async () => {
    const event = { ...createEvent('user-rec'), msg: '#kkk录直播' }

    await expect(new ToolsApp().recordLive(event)).resolves.toBe(true)

    expect(event.reply).toHaveBeenCalledWith('要在 #kkk录直播 后面带上抖音或B站的直播间链接')
    expect(recordLiveRoomMock).not.toHaveBeenCalled()
  })

  it.each([
    ['快手', 'https://v.kuaishou.com/abc'],
    ['非平台域名', 'https://example.com/live/1']
  ])('%s 链接一律拒掉：能触发规则但录不了的必须说清楚', async (_label, url) => {
    const event = { ...createEvent('user-rec'), msg: `#kkk录直播 ${url}` }

    await expect(new ToolsApp().recordLive(event)).resolves.toBe(true)

    expect(event.reply).toHaveBeenCalledWith('只能录抖音和B站的直播间，且对应平台的解析开关要开着')
    expect(recordLiveRoomMock).not.toHaveBeenCalled()
  })

  it('录制没成也返回 true —— 返回 false 在宿主那边是「继续往后派」', async () => {
    recordLiveRoomMock.mockResolvedValue(false)
    const event = { ...createEvent('user-rec'), msg: '#kkk录直播 https://live.douyin.com/26139686' }

    await expect(new ToolsApp().recordLive(event)).resolves.toBe(true)
    expect(recordLiveRoomMock).toHaveBeenCalledTimes(1)
  })
})
