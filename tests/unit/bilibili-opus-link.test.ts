import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { RichTextDocument } from '@kkk/richtext'
import { createOpusLinkNode, extractRichTextPlainText } from '../../src/module/utils/richtext/parse/index.js'
import { renderRichTextToReact } from '../../ktr/richtext/react/index.js'
import * as dynamicTextModule from '../../src/module/platform/bilibili/dynamicText.js'

/**
 * 站内图文链接节点（`opusLink`，上游 f9932f8）。
 *
 * B站 opus 正文里 `node_type: 4` 的高亮链接，官方页面渲染成带图文图标的 `<a>`。
 * 这一路以前整段被丢掉：解析器只认 `node_type === 1`，其余 `return []`，
 * 于是正文里那句链接文本在卡片上凭空消失。
 */
interface ArticleApi {
  buildBilibiliArticleRichText: (
    opus: { content?: { paragraphs?: Array<Record<string, unknown>> } } | null | undefined,
    content?: string,
    useDarkTheme?: boolean
  ) => RichTextDocument
  buildBilibiliRichTextForwardNodes: (
    document: RichTextDocument,
    options?: Record<string, unknown>
  ) => Promise<Array<{ type: string, text?: string }>>
}

const articleApi = dynamicTextModule as unknown as ArticleApi

const opusWith = (nodes: Array<Record<string, unknown>>) => ({
  content: { paragraphs: [{ para_type: 1, text: { nodes } }] }
})

describe('opus node_type 4 解析', () => {
  it('带跳转地址时产出 opusLink 节点', () => {
    const document = articleApi.buildBilibiliArticleRichText(
      opusWith([{ node_type: 4, link: { show_text: '这是一篇图文', link: 'https://www.bilibili.com/opus/123' } }])
    )

    expect(document.nodes[0]).toMatchObject({
      type: 'paragraph',
      nodes: [{ type: 'opusLink', text: '这是一篇图文', url: 'https://www.bilibili.com/opus/123' }]
    })
  })

  it('缺跳转地址时退化成普通文本，而不是把这段正文丢掉', () => {
    const document = articleApi.buildBilibiliArticleRichText(
      opusWith([{ node_type: 4, link: { show_text: '没有地址的图文' } }])
    )

    expect(document.nodes[0]).toMatchObject({
      type: 'paragraph',
      nodes: [{ type: 'text', text: '没有地址的图文' }]
    })
  })

  it('连显示文本都没有时整个节点跳过，不产出空段落', () => {
    const document = articleApi.buildBilibiliArticleRichText(
      opusWith([{ node_type: 4, link: {} }])
    )

    expect(document.nodes).toEqual([])
  })

  it('和普通文字节点混排时保持先后次序', () => {
    const document = articleApi.buildBilibiliArticleRichText(
      opusWith([
        { node_type: 1, word: { words: '看这个：' } },
        { node_type: 4, link: { show_text: '图文标题', link: 'https://www.bilibili.com/opus/456' } }
      ])
    )

    expect((document.nodes[0] as { nodes: Array<{ type: string }> }).nodes.map(node => node.type))
      .toEqual(['text', 'opusLink'])
  })
})

describe('opusLink 的三个出口', () => {
  it('纯文本提取读得到它的显示文本', () => {
    const document: RichTextDocument = {
      version: 1,
      platform: 'bilibili',
      nodes: [{ type: 'paragraph', nodes: [createOpusLinkNode('图文标题', 'https://www.bilibili.com/opus/789')] }]
    }

    expect(extractRichTextPlainText(document)).toContain('图文标题')
  })

  it('合并转发把它拼成「文本(地址)」，和 webLink 同一形状', async () => {
    const document: RichTextDocument = {
      version: 1,
      platform: 'bilibili',
      nodes: [{ type: 'paragraph', nodes: [createOpusLinkNode('图文标题', 'https://www.bilibili.com/opus/789')] }]
    }

    const nodes = await articleApi.buildBilibiliRichTextForwardNodes(document)
    const text = nodes.filter(node => node.type === 'text').map(node => node.text).join('\n')

    expect(text).toContain('图文标题')
    expect(text).toContain('https://www.bilibili.com/opus/789')
  })

  it('模板渲染出图标和文本，并把地址留在 data 属性上', () => {
    const document: RichTextDocument = {
      version: 1,
      platform: 'bilibili',
      nodes: [createOpusLinkNode('图文标题', 'https://www.bilibili.com/opus/789')]
    }

    const html = renderToStaticMarkup(
      createElement('div', {}, renderRichTextToReact(document, { opusLink: { className: 'text-[#006A9E]' } }))
    )

    expect(html).toContain('data-richtext-node="opusLink"')
    expect(html).toContain('data-url="https://www.bilibili.com/opus/789"')
    expect(html).toContain('图文标题')
    // 图标是 svg，缺了这段就只剩裸文本、和普通文字分不开
    expect(html).toContain('<svg')
    expect(html).toContain('text-[#006A9E]')
  })
})
