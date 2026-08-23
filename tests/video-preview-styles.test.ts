import { describe, expect, it } from 'vitest'

import { renderVideoPreviewPage } from '../src/module/server/video-preview.js'

describe('video preview page styles', () => {
  it('embeds the layout CSS when no external stylesheet is supplied', () => {
    const html = renderVideoPreviewPage({
      filename: 'demo.mp4',
      filePath: 'demo.mp4',
      videoUrl: '/kkk/v1/stream/demo.mp4',
      removeCache: true,
      createdAt: 1_700_000_000_000,
      expireAt: 1_700_000_060_000,
      now: () => 1_700_000_000_000
    })

    expect(html).toContain('.preview-page')
    expect(html).toContain('display: flex')
    expect(html).toContain('preview-video')
  })
})
