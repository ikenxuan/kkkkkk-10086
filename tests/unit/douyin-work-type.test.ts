import { describe, expect, it } from 'vitest'

import { getDouyinLiveVideoUrl, getDouyinWorkCoverUrl } from '../../src/module/platform/douyin/workType.js'

/**
 * 抖音图床会把封面套上 `~tplv-dy-360p` 这类降质模板，签名绑在路径上，改 URL 换不回原图。
 *
 * 作品详情接口不返回 animated_cover，取封面的优先级会一路落到 cover_original_scale，
 * 而它的 url_list[0] 恰好常是降质模板 —— 旧实现「每个字段只看 url_list[0]、命中就返回」，
 * 于是把糊图当封面推出去。这组用例钉的就是「有清晰候选时不能选糊的」。
 */
const videoAweme = (video: Record<string, { url_list: string[] }>) => ({
  aweme_type: 0,
  video
})

describe('getDouyinWorkCoverUrl 视频封面降质规避', () => {
  it('候选里同时有降质图和原图时选原图', () => {
    // cover_original_scale 排在 cover 前面，但它整条 url_list 都是 360p 模板，
    // 按旧的「取第一个字段的 [0]」会返回它
    const cover = getDouyinWorkCoverUrl(videoAweme({
      cover_original_scale: { url_list: ['https://p9.douyinpic.com/a~tplv-dy-360p.jpeg'] },
      cover: { url_list: ['https://p9.douyinpic.com/a~tplv-dy-origin.jpeg'] }
    }))

    expect(cover).toBe('https://p9.douyinpic.com/a~tplv-dy-origin.jpeg')
  })

  it('同一个字段内部也会跳过降质项', () => {
    // 降质与原图常挂在同一个 url_list 的不同下标上，只取 [0] 永远看不到后面的原图
    const cover = getDouyinWorkCoverUrl(videoAweme({
      cover_original_scale: {
        url_list: [
          'https://p9.douyinpic.com/a~tplv-dy-480p.jpeg',
          'https://p9.douyinpic.com/a~tplv-dy-origin.jpeg'
        ]
      }
    }))

    expect(cover).toBe('https://p9.douyinpic.com/a~tplv-dy-origin.jpeg')
  })

  it('全部候选都被降质时退回第一个，不能返回空串', () => {
    // 兜底行为必须不比修复前差：没有干净候选时仍要给出一个能显示的封面
    const cover = getDouyinWorkCoverUrl(videoAweme({
      cover_original_scale: { url_list: ['https://p9.douyinpic.com/a~tplv-dy-270p.jpeg'] },
      cover: { url_list: ['https://p9.douyinpic.com/b~tplv-dy-540p.jpeg'] }
    }))

    expect(cover).toBe('https://p9.douyinpic.com/a~tplv-dy-270p.jpeg')
  })

  it('保留本仓库比上游多出来的 dynamic_cover 候选', () => {
    // 上游的候选表里没有 dynamic_cover，这是本仓库自己加的兜底，不能为了对齐上游删掉
    const cover = getDouyinWorkCoverUrl(videoAweme({
      dynamic_cover: { url_list: ['https://p9.douyinpic.com/dynamic.jpeg'] }
    }))

    expect(cover).toBe('https://p9.douyinpic.com/dynamic.jpeg')
  })

  it('优先级不变：animated_cover 仍然排在最前', () => {
    const cover = getDouyinWorkCoverUrl(videoAweme({
      animated_cover: { url_list: ['https://p9.douyinpic.com/animated.jpeg'] },
      dynamic_cover: { url_list: ['https://p9.douyinpic.com/dynamic.jpeg'] },
      cover: { url_list: ['https://p9.douyinpic.com/cover.jpeg'] }
    }))

    expect(cover).toBe('https://p9.douyinpic.com/animated.jpeg')
  })

  it('没有任何候选时返回空串', () => {
    expect(getDouyinWorkCoverUrl(videoAweme({}))).toBe('')
    expect(getDouyinWorkCoverUrl(undefined)).toBe('')
  })

  it('低清模板判定不误伤 URL 里正常出现的 360p 字样', () => {
    // 只有跟在 ~tplv- 后面的处理模板才是降质标记；查询串里的 360p 不算
    const cover = getDouyinWorkCoverUrl(videoAweme({
      cover: { url_list: ['https://p9.douyinpic.com/real-cover.jpeg?ratio=360p'] }
    }))

    expect(cover).toBe('https://p9.douyinpic.com/real-cover.jpeg?ratio=360p')
  })
})

/**
 * 实况图取地址：必须走 `url_list` 的签名直链，不能自己拼 `aweme.snssdk.com`。
 *
 * 实测三条代价（都拿真实作品量过）：snssdk 在这条路上冷握手 5.7 秒而直链 0.3 秒
 * （线上表现是一个五张图的作品五张全 ECONNRESET，全部退化成静态图）；
 * `ratio=1080p` 会覆盖已选中的档位；302 会落到 `*.ctydoh.cn:20080` 这类随机字串域名。
 */
const DIRECT_H264 = 'https://v26-web.douyinvod.com/abc/?a=1128&sign=h264sig'
const DIRECT_FALLBACK = 'https://v11-weba.douyinvod.com/def/?a=1128&sign=fallbacksig'

describe('getDouyinLiveVideoUrl 实况图取地址', () => {
  it('优先返回 play_addr_h264 的签名直链', () => {
    const url = getDouyinLiveVideoUrl({
      video: {
        play_addr_h264: { uri: 'v0300fg10000abcdef', url_list: [DIRECT_H264, DIRECT_FALLBACK] },
        play_addr: { uri: 'v0300fg10000abcdef', url_list: ['https://v11-weba.douyinvod.com/other/'] }
      }
    })

    expect(url).toBe(DIRECT_H264)
  })

  it('h264 缺 url_list 时退到 play_addr 的直链，而不是就地拼 snssdk', () => {
    // 关键点：play_addr_h264 存在但只有 uri，旧实现会立刻拿这个 uri 拼 snssdk，
    // 白白放掉 play_addr 上现成的直链
    const url = getDouyinLiveVideoUrl({
      video: {
        play_addr_h264: { uri: 'v0300fg10000abcdef' },
        play_addr: { uri: 'v0300fg10000abcdef', url_list: [DIRECT_FALLBACK] }
      }
    })

    expect(url).toBe(DIRECT_FALLBACK)
  })

  it('同一个 url_list 里跳过空串，取第一条真地址', () => {
    const url = getDouyinLiveVideoUrl({
      video: { play_addr_h264: { url_list: ['', DIRECT_H264] } }
    })

    expect(url).toBe(DIRECT_H264)
  })

  it('两个字段都没有 url_list 时才兜底拼 snssdk', () => {
    // 兜底不能删：老数据或异常响应确实可能只给 uri。但它必须是最后一步。
    const url = getDouyinLiveVideoUrl({
      video: { play_addr: { uri: 'v0300fg10000abcdef' } }
    })

    expect(url).toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=v0300fg10000abcdef&ratio=1080p&line=0')
  })

  it('拿到直链时绝不含 snssdk / ratio 参数', () => {
    // ratio=1080p 会让服务端按 ratio 重新给流，覆盖挑好的档位
    const url = getDouyinLiveVideoUrl({
      video: { play_addr_h264: { uri: 'v0300fg10000abcdef', url_list: [DIRECT_H264] } }
    })

    expect(url).not.toContain('aweme.snssdk.com')
    expect(url).not.toContain('ratio=')
  })

  it('没有 video 节点或整个入参缺失时返回空串', () => {
    expect(getDouyinLiveVideoUrl({})).toBe('')
    expect(getDouyinLiveVideoUrl(undefined)).toBe('')
    expect(getDouyinLiveVideoUrl({ video: {} })).toBe('')
    expect(getDouyinLiveVideoUrl({ video: { play_addr_h264: { url_list: [] } } })).toBe('')
  })
})
