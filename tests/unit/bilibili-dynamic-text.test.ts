import { describe, expect, it } from 'vitest'

import type { RichTextDocument } from '../../ktr/richtext/types.js'
import * as dynamicTextModule from '../../src/module/platform/bilibili/dynamicText.js'

type ArticleOpus = Parameters<ArticleDynamicTextApi['buildBilibiliArticleRichText']>[0]

type ForwardNode =
  | { type: 'text', text: string }
  | { type: 'image', src: string, alt?: string, caption?: string }

interface ArticleDynamicTextApi {
  parseHtmlContentToRichText: (content: string) => RichTextDocument
  buildBilibiliArticleRichText: (
    opus: {
      content?: {
        paragraphs?: Array<Record<string, unknown>>
      }
    } | null | undefined,
    content?: string,
    useDarkTheme?: boolean
  ) => RichTextDocument
  buildBilibiliRichTextForwardNodes: (
    document: RichTextDocument,
    options?: {
      title?: string
      summary?: string
      shareUrl?: string
      maxTextLength?: number
      imageResolver?: (src: string, index: number) => Promise<string | null | undefined> | string | null | undefined
    }
  ) => Promise<ForwardNode[]>
}

const articleApi = dynamicTextModule as unknown as ArticleDynamicTextApi

const textOf = (node: { nodes?: Array<{ type?: string, text?: string }> }): string =>
  (node.nodes || []).map(child => child.type === 'lineBreak' ? '\n' : child.text || '').join('')

const textParts = (nodes: ForwardNode[]): string[] =>
  nodes.filter((node): node is Extract<ForwardNode, { type: 'text' }> => node.type === 'text').map(node => node.text)

describe('parseHtmlContentToRichText', () => {
  it('parses headings, paragraphs, quotes, lists, code, links, rules and images into host-neutral nodes', () => {
    expect(typeof articleApi.parseHtmlContentToRichText).toBe('function')

    const document = articleApi.parseHtmlContentToRichText(`
      <h2>章节标题</h2>
      <p>普通段落 <strong>加粗</strong> <a href="https://example.com/read">链接</a></p>
      <blockquote>引用内容</blockquote>
      <ul><li>无序一</li><li>无序二</li></ul>
      <ol><li>有序一</li><li>有序二</li></ol>
      <pre><code class="language-ts">const ok = 1 &lt; 2</code></pre>
      <hr>
      <img src="//i.example.com/article.jpg" alt="正文插图">
    `)

    expect(document.version).toBe(1)
    expect(document.platform).toBe('bilibili')
    expect(document.nodes.map(node => node.type)).toEqual([
      'heading',
      'paragraph',
      'blockquote',
      'list',
      'list',
      'codeBlock',
      'horizontalRule',
      'image'
    ])

    expect(document.nodes[0]).toMatchObject({ type: 'heading', level: 2 })
    expect(textOf(document.nodes[0] as never)).toBe('章节标题')
    expect(document.nodes[1]).toMatchObject({
      type: 'paragraph',
      nodes: expect.arrayContaining([
        expect.objectContaining({ type: 'text', text: '加粗', style: expect.objectContaining({ bold: true }) }),
        expect.objectContaining({ type: 'text', text: '链接', style: expect.objectContaining({ link: 'https://example.com/read' }) })
      ])
    })
    expect(document.nodes[2]).toMatchObject({ type: 'blockquote' })
    expect(textOf(document.nodes[2] as never)).toBe('引用内容')
    expect(document.nodes[3]).toMatchObject({
      type: 'list',
      ordered: false,
      items: [
        expect.objectContaining({ type: 'listItem' }),
        expect.objectContaining({ type: 'listItem' })
      ]
    })
    expect(document.nodes[4]).toMatchObject({ type: 'list', ordered: true })
    expect(document.nodes[5]).toEqual({ type: 'codeBlock', language: 'ts', content: 'const ok = 1 < 2' })
    expect(document.nodes[6]).toEqual({ type: 'horizontalRule' })
    expect(document.nodes[7]).toEqual({
      type: 'image',
      src: 'https://i.example.com/article.jpg',
      alt: '正文插图'
    })
  })

  it('returns an empty bilibili document for empty markup', () => {
    expect(typeof articleApi.parseHtmlContentToRichText).toBe('function')
    expect(articleApi.parseHtmlContentToRichText('  \n\t ')).toEqual({
      version: 1,
      platform: 'bilibili',
      nodes: []
    })
  })

  it('keeps surrounding text and image fallback text when an image has no usable source', () => {
    expect(typeof articleApi.parseHtmlContentToRichText).toBe('function')
    const document = articleApi.parseHtmlContentToRichText(
      '<p>图片之前</p><img alt="加载失败的插图"><p>图片之后</p>'
    )

    expect(document.nodes.map(node => node.type)).toEqual(['paragraph', 'paragraph', 'paragraph'])
    expect(document.nodes.map(node => textOf(node as never))).toEqual([
      '图片之前',
      '加载失败的插图',
      '图片之后'
    ])
  })
})

describe('buildBilibiliArticleRichText', () => {
  it('prefers opus and parses heading, paragraph, quote, lists, code, link card, rule and image paragraphs', () => {
    expect(typeof articleApi.buildBilibiliArticleRichText).toBe('function')

    const word = (words: string, style: Record<string, unknown> = {}) => ({
      node_type: 1,
      word: { words, style }
    })
    const opus = {
      content: {
        paragraphs: [
          { para_type: 9, format: { heading_type: 3 }, text: { nodes: [word('Opus 标题')] } },
          { para_type: 1, text: { nodes: [word('正文'), word('链接', { link: 'https://example.com/opus' })] } },
          { para_type: 4, text: { nodes: [word('引用')] } },
          { para_type: 1, text: { nodes: [word('无序一', { list: 'bullet' })] } },
          { para_type: 1, text: { nodes: [word('无序二', { list: 'bullet' })] } },
          { para_type: 1, text: { nodes: [word('有序一', { list: 'ordered' })] } },
          { para_type: 8, code: { content: 'console.log("ok")', lang: 'js' } },
          {
            para_type: 7,
            link_card: {
              default_text: '默认卡片',
              card: { show_text: '视频卡片', link: 'https://example.com/video', link_type: 2 }
            }
          },
          { para_type: 3 },
          { para_type: 2, pic: { pics: [{ url: '//i.example.com/opus.jpg', alt: 'Opus 图', comment: '图片说明' }] } }
        ]
      }
    } satisfies ArticleOpus

    const document = articleApi.buildBilibiliArticleRichText(
      opus,
      '<p>不应使用的 HTML</p>',
      false
    )

    expect(document.nodes.map(node => node.type)).toEqual([
      'heading',
      'paragraph',
      'blockquote',
      'list',
      'list',
      'codeBlock',
      'linkCard',
      'horizontalRule',
      'image'
    ])
    expect(document.nodes[0]).toMatchObject({ type: 'heading', level: 3 })
    expect(document.nodes[1]).toMatchObject({
      type: 'paragraph',
      nodes: expect.arrayContaining([
        expect.objectContaining({ text: '链接', style: expect.objectContaining({ link: 'https://example.com/opus' }) })
      ])
    })
    expect(document.nodes[3]).toMatchObject({ type: 'list', ordered: false, items: expect.any(Array) })
    expect((document.nodes[3] as { items: unknown[] }).items).toHaveLength(2)
    expect(document.nodes[4]).toMatchObject({ type: 'list', ordered: true })
    expect(document.nodes[5]).toEqual({ type: 'codeBlock', content: 'console.log("ok")', language: 'js' })
    expect(document.nodes[6]).toMatchObject({
      type: 'linkCard',
      title: '视频卡片',
      url: 'https://example.com/video',
      cardType: '2'
    })
    expect(document.nodes[8]).toEqual({
      type: 'image',
      src: 'https://i.example.com/opus.jpg',
      alt: 'Opus 图',
      caption: '图片说明'
    })
  })

  it('falls back to legacy HTML and supports empty and pure-image articles', () => {
    expect(typeof articleApi.buildBilibiliArticleRichText).toBe('function')

    const htmlDocument = articleApi.buildBilibiliArticleRichText(undefined, '<p>旧版正文</p>')
    expect(htmlDocument.nodes).toHaveLength(1)
    expect(textOf(htmlDocument.nodes[0] as never)).toBe('旧版正文')

    expect(articleApi.buildBilibiliArticleRichText(undefined, undefined)).toEqual({
      version: 1,
      platform: 'bilibili',
      nodes: []
    })

    expect(articleApi.buildBilibiliArticleRichText({
      content: {
        paragraphs: [{ para_type: 2, pic: { pics: [{ url: 'https://i.example.com/only.jpg' }] } }]
      }
    } as ArticleOpus).nodes).toEqual([
      { type: 'image', src: 'https://i.example.com/only.jpg', alt: '专栏图片' }
    ])
  })

  it('preserves a failed opus image description instead of discarding article text', () => {
    expect(typeof articleApi.buildBilibiliArticleRichText).toBe('function')

    const document = articleApi.buildBilibiliArticleRichText({
      content: {
        paragraphs: [
          { para_type: 1, text: { nodes: [{ node_type: 1, word: { words: '正文仍在' } }] } },
          { para_type: 2, pic: { pics: [{ alt: '图片不可用', comment: '原图说明' }] } }
        ]
      }
    } as ArticleOpus)

    expect(document.nodes.map(node => node.type)).toEqual(['paragraph', 'paragraph'])
    expect(document.nodes.map(node => textOf(node as never))).toEqual(['正文仍在', '图片不可用（原图说明）'])
  })
})

describe('buildBilibiliRichTextForwardNodes', () => {
  it('emits title, summary and share URL as text plus images in original order without host segments', async () => {
    expect(typeof articleApi.buildBilibiliRichTextForwardNodes).toBe('function')

    const document = articleApi.parseHtmlContentToRichText(
      '<p>第一段</p><img src="https://i.example.com/a.jpg" alt="插图"><p>第二段</p>'
    )
    const nodes = await articleApi.buildBilibiliRichTextForwardNodes(document, {
      title: '专栏标题',
      summary: '专栏摘要',
      shareUrl: 'https://www.bilibili.com/read/cv1'
    })

    expect(nodes.map(node => node.type)).toEqual(['text', 'image', 'text'])
    expect(nodes[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('标题：专栏标题')
    })
    expect((nodes[0] as { text: string }).text).toContain('简介：专栏摘要')
    expect((nodes[0] as { text: string }).text).toContain('链接：https://www.bilibili.com/read/cv1')
    expect((nodes[0] as { text: string }).text).toContain('第一段')
    expect(nodes[1]).toEqual({
      type: 'image',
      src: 'https://i.example.com/a.jpg',
      alt: '插图'
    })
    expect(nodes[2]).toEqual({ type: 'text', text: '第二段' })
  })

  it('splits oversized text nodes without losing or reordering content', async () => {
    expect(typeof articleApi.buildBilibiliRichTextForwardNodes).toBe('function')

    const source = '甲'.repeat(45)
    const document = articleApi.parseHtmlContentToRichText(`<p>${source}</p>`)
    const nodes = await articleApi.buildBilibiliRichTextForwardNodes(document, { maxTextLength: 16 })
    const chunks = textParts(nodes)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(chunk => chunk.length <= 16)).toBe(true)
    expect(chunks.join('')).toBe(source)
  })

  it('keeps text before and after an image when image resolution fails', async () => {
    expect(typeof articleApi.buildBilibiliRichTextForwardNodes).toBe('function')

    const document = articleApi.parseHtmlContentToRichText(
      '<p>图片前正文</p><img src="https://i.example.com/fail.jpg" alt="失败插图"><p>图片后正文</p>'
    )
    const nodes = await articleApi.buildBilibiliRichTextForwardNodes(document, {
      imageResolver: async () => {
        throw new Error('download failed')
      }
    })

    expect(nodes.some(node => node.type === 'image')).toBe(false)
    expect(textParts(nodes).join('\n')).toContain('图片前正文')
    expect(textParts(nodes).join('\n')).toContain('失败插图')
    expect(textParts(nodes).join('\n')).toContain('图片后正文')
  })

  it('returns no forward nodes for an empty article and one image node for a pure-image article', async () => {
    expect(typeof articleApi.buildBilibiliRichTextForwardNodes).toBe('function')

    const empty = articleApi.buildBilibiliArticleRichText(undefined, undefined)
    expect(await articleApi.buildBilibiliRichTextForwardNodes(empty)).toEqual([])

    const pureImage = articleApi.parseHtmlContentToRichText('<img src="https://i.example.com/only.jpg">')
    expect(await articleApi.buildBilibiliRichTextForwardNodes(pureImage)).toEqual([
      { type: 'image', src: 'https://i.example.com/only.jpg', alt: '专栏图片' }
    ])
  })
})
