import { describe, expect, it, vi } from 'vitest'

import { getUsernameMetadata } from '../../src/module/platform/bilibili/dynamicText.js'
import {
  createBilibiliRichTextForwardMessage,
  mapBilibiliRichTextNodesToSegments
} from '../../src/module/platform/bilibili/richtext-message.js'

const createSegmentFactory = () => ({
  text: vi.fn((value: string) => ({ kind: 'text', value })),
  image: vi.fn((src: string) => ({ kind: 'image', src }))
})

describe('Bilibili rich-text host message adapter', () => {
  it('maps text and image nodes in order while preserving text fallbacks', () => {
    const segmentFactory = createSegmentFactory()

    const result = mapBilibiliRichTextNodesToSegments([
      { type: 'text', text: '正文开头' },
      { type: 'image', src: 'https://i.example.com/article.jpg', alt: '专栏插图' },
      { type: 'text', text: '图片解析失败（备用说明）' },
      { type: 'text', text: '   ' },
      { type: 'image', src: '' }
    ], segmentFactory)

    expect(result).toEqual([
      { kind: 'text', value: '正文开头' },
      { kind: 'image', src: 'https://i.example.com/article.jpg' },
      { kind: 'text', value: '图片解析失败（备用说明）' }
    ])
    expect(segmentFactory.text).toHaveBeenCalledTimes(2)
    expect(segmentFactory.image).toHaveBeenCalledTimes(1)
  })

  it('builds one host forward message from mapped nodes', async () => {
    const segmentFactory = createSegmentFactory()
    const makeForwardMsg = vi.fn(async (messages: unknown[], title: string) => ({ messages, title }))

    const result = await createBilibiliRichTextForwardMessage([
      { type: 'text', text: '专栏标题\n\n正文' },
      { type: 'image', src: 'https://i.example.com/cover.jpg' }
    ], {
      segmentFactory,
      makeForwardMsg,
      title: '专栏内容'
    })

    expect(makeForwardMsg).toHaveBeenCalledOnce()
    expect(makeForwardMsg).toHaveBeenCalledWith([
      { kind: 'text', value: '专栏标题\n\n正文' },
      { kind: 'image', src: 'https://i.example.com/cover.jpg' }
    ], '专栏内容')
    expect(result).toEqual({
      messages: [
        { kind: 'text', value: '专栏标题\n\n正文' },
        { kind: 'image', src: 'https://i.example.com/cover.jpg' }
      ],
      title: '专栏内容'
    })
  })

  it('does not invoke the host forward API when every node is empty', async () => {
    const makeForwardMsg = vi.fn()

    const result = await createBilibiliRichTextForwardMessage([
      { type: 'text', text: '\n\t ' },
      { type: 'image', src: '' }
    ], {
      segmentFactory: createSegmentFactory(),
      makeForwardMsg
    })

    expect(result).toBeNull()
    expect(makeForwardMsg).not.toHaveBeenCalled()
  })
})

describe('getUsernameMetadata', () => {
  it('keeps the nickname color only for active VIP users', () => {
    expect(getUsernameMetadata({
      name: '大会员用户',
      vip: { status: 1, nickname_color: '#FB7299' }
    })).toEqual({
      name: '大会员用户',
      vipStatus: 1,
      nicknameColor: '#FB7299'
    })

    expect(getUsernameMetadata({
      name: '普通用户',
      vip: { status: 0, nickname_color: '#FB7299' }
    })).toEqual({
      name: '普通用户',
      vipStatus: 0,
      nicknameColor: null
    })
  })

  it('normalizes missing profile fields for the React template contract', () => {
    expect(getUsernameMetadata({})).toEqual({
      name: '',
      vipStatus: 0,
      nicknameColor: null
    })
  })
})
