import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 四条免鉴权接口（ikenxuan/amagi#188）的用法契约：**取数一律走 amagi，读响应全留在插件**。
 *
 * 这批方法还没进正式版本号，所以本文件是唯一能验证「参数怎么传、信封怎么剥」的地方。
 * 另一半是降级：`douyinGuest` 给 `undefined` 时各条路必须退回自己的兜底，
 * 而不是 `undefined(...)` 炸在用户面前。
 */

const mocks = vi.hoisted(() => ({
  guest: vi.fn(),
  buildAmagiRequestConfig: vi.fn(() => ({ timeout: 1 }))
}))

vi.mock('../../src/module/utils/amagiClient.js', () => ({
  douyinGuest: mocks.guest,
  buildAmagiRequestConfig: mocks.buildAmagiRequestConfig
}))

import { syncDouyinEmojiResource } from '../../src/module/platform/douyin/emojiRes.js'
import { fetchGuestDouyinMusicAwemeIds, fetchGuestDouyinMusicInfo } from '../../src/module/platform/douyin/musicInfo.js'
import { resolveDouyinUserByShortId } from '../../src/module/platform/douyin/resolveUser.js'

/** `wrapAmagiClient` 把失败信封抛成 AmagiError；这里只需要「会抛」这一点 */
class FakeAmagiError extends Error {}

const respondWith = (body: unknown): ReturnType<typeof vi.fn> => {
  const call = vi.fn(async () => body)
  mocks.guest.mockReturnValue(call)
  return call
}

const throwFrom = (message: string): void => {
  mocks.guest.mockReturnValue(vi.fn(async () => { throw new FakeAmagiError(message) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  mocks.guest.mockReset()
  mocks.buildAmagiRequestConfig.mockReturnValue({ timeout: 1 })
})

describe('抖音号 → sec_uid 走 fetchGuestUserInfo', () => {
  it('按 unique_id 取数，从 data.user_info 里读四个字段', async () => {
    const call = respondWith({
      data: { user_info: { sec_uid: 'sec-1', nickname: '张三', unique_id: 'ubb_up', short_id: '123' } }
    })

    await expect(resolveDouyinUserByShortId('ubb_up')).resolves.toEqual({
      sec_uid: 'sec-1', nickname: '张三', unique_id: 'ubb_up', short_id: '123'
    })
    expect(mocks.guest).toHaveBeenCalledWith('fetchGuestUserInfo')
    // 这条接口不需要 cookie，但签名保持与其他 fetcher 同形
    expect(call).toHaveBeenCalledWith({ unique_id: 'ubb_up' }, '', { timeout: 1 })
  })

  it('接口回的 unique_id 与输入不一致就退回 null，绝不交出「差不多的那个人」', async () => {
    respondWith({ data: { user_info: { sec_uid: 'sec-2', unique_id: 'someone_else' } } })
    await expect(resolveDouyinUserByShortId('ubb_up')).resolves.toBeNull()
  })

  it('只有大小写不同算同一个号', async () => {
    respondWith({ data: { user_info: { sec_uid: 'sec-3', unique_id: 'UBB_UP' } } })
    await expect(resolveDouyinUserByShortId('ubb_up')).resolves.toMatchObject({ sec_uid: 'sec-3' })
  })

  it('号不存在（status_code 5 → AmagiError）是干净的失败信号，吞掉给 null', async () => {
    throwFrom('参数不合法')
    await expect(resolveDouyinUserByShortId('nope')).resolves.toBeNull()
  })

  it('装的 amagi 没有这批方法时给 null，让调用方退回搜索', async () => {
    mocks.guest.mockReturnValue(undefined)
    await expect(resolveDouyinUserByShortId('ubb_up')).resolves.toBeNull()
    expect(mocks.guest).toHaveBeenCalledWith('fetchGuestUserInfo')
  })
})

describe('原声走 fetchGuestMusicInfo / fetchGuestMusicAwemeList', () => {
  it('本体从 data.music_info 里读', async () => {
    const call = respondWith({ data: { music_info: { mid: '7662028782940850971', title: '歌' } } })

    await expect(fetchGuestDouyinMusicInfo('7662028782940850971'))
      .resolves.toEqual({ mid: '7662028782940850971', title: '歌' })
    expect(call).toHaveBeenCalledWith({ music_id: '7662028782940850971' }, '', { timeout: 1 })
  })

  it('没有 mid 就当没认出这条原声', async () => {
    respondWith({ data: { music_info: { title: '歌' } } })
    await expect(fetchGuestDouyinMusicInfo('762')).resolves.toBeNull()
  })

  it('作品列表按 number 取，只收字符串 aweme_id', async () => {
    const call = respondWith({ data: { aweme_list: [{ aweme_id: 'a1' }, { aweme_id: 2 }, {}] } })

    await expect(fetchGuestDouyinMusicAwemeIds('762', { count: 5 })).resolves.toEqual(['a1'])
    expect(call).toHaveBeenCalledWith({ music_id: '762', number: 5 }, '', { timeout: 1 })
  })

  it('缺 count 时用默认的 10', async () => {
    const call = respondWith({ data: { aweme_list: [] } })
    await expect(fetchGuestDouyinMusicAwemeIds('762')).resolves.toEqual([])
    expect(call).toHaveBeenCalledWith({ music_id: '762', number: 10 }, '', { timeout: 1 })
  })

  it('amagi 抛错时给空数组，不影响原声本体那一半', async () => {
    throwFrom('风控')
    await expect(fetchGuestDouyinMusicAwemeIds('762')).resolves.toEqual([])
  })
})

describe('表情资源包走 fetchEmojiResourceMeta', () => {
  it('包地址从 data.android_emoji_resource 里剥', async () => {
    const download = vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }))
    vi.stubGlobal('fetch', download)

    // md5 对不上所以结果是 null —— 这里要的是「地址确实剥出来了」
    await expect(syncDouyinEmojiResource(async () => ({
      data: { android_emoji_resource: { md5: 'deadbeef', resource_url: 'https://example.com/pack.zip' } }
    }))).resolves.toBeNull()
    expect(download).toHaveBeenCalledWith('https://example.com/pack.zip', expect.anything())
  })

  it('信封里没有 android_emoji_resource 就整轮跳过，一个字节都不下', async () => {
    const download = vi.fn()
    vi.stubGlobal('fetch', download)

    await expect(syncDouyinEmojiResource(async () => ({ data: {} }))).resolves.toBeNull()
    expect(download).not.toHaveBeenCalled()
  })

  it('装的 amagi 没有 fetchEmojiResourceMeta 时整轮跳过', async () => {
    mocks.guest.mockReturnValue(undefined)
    await expect(syncDouyinEmojiResource()).resolves.toBeNull()
    expect(mocks.guest).toHaveBeenCalledWith('fetchEmojiResourceMeta')
  })
})
