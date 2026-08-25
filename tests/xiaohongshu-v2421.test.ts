import axios from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getXiaohongshuID, resolveEffectiveLink } from '../src/module/platform/xiaohongshu/getid.js'
import { buildXiaohongshuShareUrl, isXiaohongshuLink } from '../src/module/platform/xiaohongshu/link.js'

const mockRedirect = (responseUrl: string) => {
  vi.spyOn(axios, 'get').mockResolvedValue({
    request: { res: { responseUrl } }
  } as never)
}

describe('小红书 v2.42.1 链接兼容', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    'https://www.xiaohongshu.com/explore/abc123',
    'https://xhslink.com/abc123',
    'https://xhslink.cn/o/abc123'
  ])('识别支持的域名: %s', (value) => {
    expect(isXiaohongshuLink(value)).toBe(true)
  })

  it('对二维码分享链接中的 xsec_token 进行 URL 编码', () => {
    // xsec_source 和 xsec_token 是成对校验的：只带 token 不带 xsec_source 时，
    // 小红书常把链接判成失效，扫码落到「笔记不可见/请登录」。四个参数照抄官方 pc 分享形态。
    expect(buildXiaohongshuShareUrl('note123', 'token+with&reserved#chars'))
      .toBe('https://www.xiaohongshu.com/discovery/item/note123?source=webshare&xhsshare=pc_web&xsec_token=token%2Bwith%26reserved%23chars&xsec_source=pc_share')
  })

  it('没有 xsec_token 时仍保留其余分享参数', () => {
    expect(buildXiaohongshuShareUrl('note123'))
      .toBe('https://www.xiaohongshu.com/discovery/item/note123?source=webshare&xhsshare=pc_web&xsec_source=pc_share')
  })

  it('从 explore 的 target_note_id 查询参数提取笔记 ID', async () => {
    mockRedirect('https://www.xiaohongshu.com/explore?target_note_id=target123')

    await expect(getXiaohongshuID('https://xhslink.cn/o/test', false)).resolves.toMatchObject({
      type: 'note',
      note_id: 'target123'
    })
  })

  it('解码普通 redirectPath 并继续提取笔记 ID', async () => {
    const target = 'https://www.xiaohongshu.com/explore/redirect123?source=share&xsec_token=inner-token'
    mockRedirect(`https://www.xiaohongshu.com/share?redirectPath=${encodeURIComponent(target)}`)

    await expect(getXiaohongshuID('https://xhslink.com/test', false)).resolves.toMatchObject({
      type: 'note',
      note_id: 'redirect123',
      xsec_token: 'inner-token'
    })
  })

  it('保留 /404 redirectPath 中目标链接的完整查询参数', async () => {
    const target = 'https://www.xiaohongshu.com/explore?source=share&target_note_id=query123&xsec_token=inner%2Btoken'
    mockRedirect(`https://www.xiaohongshu.com/404?redirectPath=${encodeURIComponent(target)}`)

    expect(resolveEffectiveLink(`https://www.xiaohongshu.com/404?redirectPath=${encodeURIComponent(target)}`))
      .toBe(target)
    await expect(getXiaohongshuID('https://xhslink.cn/o/test', false)).resolves.toMatchObject({
      type: 'note',
      note_id: 'query123',
      xsec_token: 'inner+token'
    })
  })

  it('从 redirectPath 目标链接的第二个查询参数提取笔记 ID', async () => {
    const target = 'https://www.xiaohongshu.com/explore?source=share&foo=bar&target_note_id=late123'
    mockRedirect(`https://www.xiaohongshu.com/404?redirectPath=${encodeURIComponent(target)}`)

    await expect(getXiaohongshuID('https://xhslink.com/test', false)).resolves.toMatchObject({
      type: 'note',
      note_id: 'late123'
    })
  })

  it('从最终链接的 hash 中提取小写 xsec_token', async () => {
    mockRedirect('https://www.xiaohongshu.com/explore/hash123#source=share&xsec_token=hash-token')

    await expect(getXiaohongshuID('https://xhslink.cn/o/test', false)).resolves.toMatchObject({
      type: 'note',
      note_id: 'hash123',
      xsec_token: 'hash-token'
    })
  })

  it('从原始链接 hash 中提取大写 XSEC_TOKEN', async () => {
    mockRedirect('https://www.xiaohongshu.com/explore/original123')

    await expect(getXiaohongshuID(
      'https://www.xiaohongshu.com/explore/original123#XSEC_TOKEN=original-token',
      false
    )).resolves.toMatchObject({
      type: 'note',
      note_id: 'original123',
      xsec_token: 'original-token'
    })
  })
})
