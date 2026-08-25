import { describe, expect, it } from 'vitest'

import { getDouyinWorkCoverUrl } from '../../src/module/platform/douyin/workType.js'

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
