import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

import { renderVideoPreviewPage } from '../../src/module/server/video-preview.js'

describe('React video preview page', () => {
  it('renders the preview state and escapes untrusted values', () => {
    const html = renderVideoPreviewPage({
      filename: '</title><script>globalThis.pwned=true</script>.mp4',
      filePath: 'E:/video/example.mp4',
      videoUrl: '/kkk/v1/stream/example.mp4?x=<unsafe>',
      removeCache: true,
      createdAt: 1_000,
      expireAt: 61_000,
      eventsUrl: '/kkk/v1/video/example.mp4/events',
      now: () => 1_000,
      css: '.preview-test{display:block}'
    })

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('id="preview-countdown"')
    expect(html).toContain('/kkk/v1/video/example.mp4/events')
    expect(html).toContain('.preview-test{display:block}')
    expect(html).toContain('01:00')
    expect(html).not.toContain('</title><script>globalThis.pwned=true</script>')
    expect(html).toContain('\\u003c/script>')
  })

  it('closes the EventSource after the server reports that the file was removed', () => {
    const html = renderVideoPreviewPage({
      filename: 'example.mp4',
      filePath: 'E:/video/example.mp4',
      videoUrl: '/kkk/v1/stream/example.mp4',
      removeCache: true,
      createdAt: 1_000,
      expireAt: 61_000,
      eventsUrl: '/kkk/v1/video/example.mp4/events',
      now: () => 1_000,
      css: ''
    })
    const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1]
    expect(script).toBeDefined()

    const countdown = { textContent: '' }
    class FakeEventSource {
      static instances: FakeEventSource[] = []
      onmessage?: (event: { data: string }) => void
      closed = false

      constructor (readonly url: string) {
        FakeEventSource.instances.push(this)
      }

      close (): void {
        this.closed = true
      }
    }

    runInNewContext(script!, {
      window: {},
      document: { getElementById: () => countdown },
      EventSource: FakeEventSource
    })

    const source = FakeEventSource.instances[0]
    expect(source).toBeDefined()
    source?.onmessage?.({
      data: JSON.stringify({ removeCache: true, removed: true })
    })
    expect(source?.closed).toBe(true)
    expect(countdown.textContent).toBe('00:00')
  })
})
