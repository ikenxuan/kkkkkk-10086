import { beforeEach, describe, expect, it, vi } from 'vitest'

const screenshotMock = vi.hoisted(() => vi.fn())
const screenshotsMock = vi.hoisted(() => vi.fn())
const renderReactTemplateMock = vi.hoisted(() => vi.fn())
const resolveReactTemplateRouteMock = vi.hoisted(() => vi.fn())
const applyWatermarkMock = vi.hoisted(() => vi.fn())

const configMock = vi.hoisted(() => ({
  app: {
    renderScale: 100,
    RemoveWatermark: true,
    RenderWaitTime: 30,
    multiPageRender: true,
    multiPageHeight: 9000,
    ambientCover: {
      coverOpacity: 0.7,
      edge: 0.9,
      middle: 0.2
    }
  }
}))

vi.mock('../../src/runtime/host/puppeteer.js', () => ({
  default: {
    screenshot: screenshotMock,
    screenshots: screenshotsMock
  }
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Config: configMock,
  Common: { useDarkTheme: () => true }
}))

vi.mock('../../src/module/utils/Version.js', () => ({
  default: {
    pluginPath: 'C:/yunzai/plugins/kkkkkk-10086',
    pluginName: 'kkkkkk-10086',
    version: '2.36.0',
    BotName: 'TRSS-Yunzai',
    BotVersion: '3.1.0'
  }
}))

vi.mock('../../src/module/utils/Watermark.js', () => ({
  applyWatermarkToImages: applyWatermarkMock,
  buildWatermarkText: () => 'watermark'
}))

vi.mock('../../src/module/utils/react-template/index.js', () => ({
  renderReactTemplate: renderReactTemplateMock,
  resolveReactTemplateRoute: resolveReactTemplateRouteMock
}))

globalThis.logger = {
  error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), mark: vi.fn()
} as unknown as typeof logger

const { Render } = await import('../../src/module/utils/Render.js')

beforeEach(() => {
  screenshotMock.mockReset()
  screenshotsMock.mockReset()
  renderReactTemplateMock.mockReset()
  resolveReactTemplateRouteMock.mockReset()
  applyWatermarkMock.mockReset()
  configMock.app.RemoveWatermark = true
  configMock.app.multiPageRender = true
  screenshotMock.mockResolvedValue({ type: 'image', file: 'single-rendered' })
  screenshotsMock.mockResolvedValue([{ type: 'image', file: 'rendered' }])
})

describe('Render React template routing', () => {
  it('sends React HTML through the fixed raw bridge to the Yunzai Puppeteer host', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue({
      route: 'other/help',
      html: '<!doctype html><html><body><div id="container">Help</div></body></html>'
    })

    const params = { title: 'Help' }
    const result = await Render('other/help', params)

    expect(renderReactTemplateMock).toHaveBeenCalledWith(
      'other/help',
      params,
      expect.objectContaining({
        scale: 1,
        theme: { mode: 'dark' },
        version: expect.objectContaining({
          pluginName: 'kkkkkk-10086',
          poweredBy: 'TRSS-Yunzai',
          frameworkVersion: '3.1.0'
        })
      })
    )
    const rendererData = renderReactTemplateMock.mock.calls[0]?.[1]
    expect(rendererData).toBe(params)
    expect(rendererData).toEqual({ title: 'Help' })
    expect(rendererData).not.toHaveProperty('useDarkTheme')
    expect(screenshotsMock).toHaveBeenCalledWith(
      'kkkkkk-10086/react/other/help',
      expect.objectContaining({
        tplFile: 'C:/yunzai/plugins/kkkkkk-10086/resources/react-template/bridge.html',
        ssrHtml: '<!doctype html><html><body><div id="container">Help</div></body></html>',
        saveId: expect.stringMatching(/^help-[0-9a-f-]{36}$/),
        imgType: 'png',
        omitBackground: true,
        multiPage: true,
        multiPageHeight: 9000,
        pageGotoParams: { waitUntil: 'load', timeout: 30000 }
      })
    )
    expect(result).toEqual([{ type: 'image', file: 'rendered' }])
  })

  it('injects Config.app.ambientCover into the React template context', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue({ route: 'other/help', html: '<!doctype html><p>ok</p>' })

    await Render('other/help')

    expect(renderReactTemplateMock).toHaveBeenCalledWith(
      'other/help',
      expect.any(Object),
      expect.objectContaining({ ambientCover: configMock.app.ambientCover })
    )
  })

  it('uses the single-page Puppeteer API for a React route when pagination is disabled', async () => {
    configMock.app.multiPageRender = false
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue({ route: 'other/help', html: '<!doctype html><p>ok</p>' })

    const result = await Render('other/help')

    expect(screenshotMock).toHaveBeenCalledWith(
      'kkkkkk-10086/react/other/help',
      expect.objectContaining({ multiPage: false, imgType: 'png', omitBackground: true })
    )
    expect(screenshotsMock).not.toHaveBeenCalled()
    expect(result).toEqual([{ type: 'image', file: 'single-rendered' }])
  })

  it('uses a distinct Puppeteer save id for concurrent renders of one route', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue({ route: 'other/help', html: '<!doctype html><p>ok</p>' })

    await Promise.all([Render('other/help'), Render('other/help')])

    const first = screenshotsMock.mock.calls[0]?.[1] as { saveId: string }
    const second = screenshotsMock.mock.calls[1]?.[1] as { saveId: string }
    expect(first.saveId).not.toBe(second.saveId)
  })

  it('keeps an unregistered route on the legacy art-template renderer', async () => {
    resolveReactTemplateRouteMock.mockReturnValue(undefined)

    await Render('admin/index', { data: { ok: true } })

    expect(renderReactTemplateMock).not.toHaveBeenCalled()
    expect(screenshotsMock).toHaveBeenCalledWith(
      'kkkkkk-10086/admin/html/index',
      expect.objectContaining({
        tplFile: 'C:/yunzai/plugins/kkkkkk-10086/resources/template/admin/html/index.html',
        data: { ok: true }
      })
    )
  })

  it('uses the single-page Puppeteer API for a legacy route when pagination is disabled', async () => {
    configMock.app.multiPageRender = false
    resolveReactTemplateRouteMock.mockReturnValue(undefined)

    const result = await Render('admin/index', { data: { ok: true } })

    expect(screenshotMock).toHaveBeenCalledWith(
      'kkkkkk-10086/admin/html/index',
      expect.objectContaining({
        tplFile: 'C:/yunzai/plugins/kkkkkk-10086/resources/template/admin/html/index.html',
        multiPage: false
      })
    )
    expect(screenshotsMock).not.toHaveBeenCalled()
    expect(result).toEqual([{ type: 'image', file: 'single-rendered' }])
  })

  it('falls back to the legacy renderer when React HTML generation fails', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockRejectedValue(new Error('registry unavailable'))

    await Render('other/help', { title: 'Help' })

    expect(screenshotsMock).toHaveBeenCalledWith(
      'kkkkkk-10086/other/html/help',
      expect.objectContaining({
        tplFile: 'C:/yunzai/plugins/kkkkkk-10086/resources/template/other/html/help.html'
      })
    )
    expect(globalThis.logger.warn).toHaveBeenCalledWith(expect.stringContaining('registry unavailable'))
  })

  it('returns false without legacy fallback or watermarking when a React capture fails', async () => {
    configMock.app.RemoveWatermark = false
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue({ route: 'other/help', html: '<!doctype html><p>help</p>' })
    screenshotsMock.mockResolvedValue(false)

    const result = await Render('other/help')

    expect(result).toBe(false)
    expect(screenshotsMock).toHaveBeenCalledTimes(1)
    expect(screenshotsMock.mock.calls[0]?.[0]).toBe('kkkkkk-10086/react/other/help')
    expect(applyWatermarkMock).not.toHaveBeenCalled()
  })

  it('returns false when a legacy capture fails', async () => {
    resolveReactTemplateRouteMock.mockReturnValue(undefined)
    screenshotsMock.mockResolvedValue(false)

    const result = await Render('admin/index')

    expect(result).toBe(false)
    expect(applyWatermarkMock).not.toHaveBeenCalled()
  })

  it('preserves the existing watermark pipeline after React screenshots', async () => {
    configMock.app.RemoveWatermark = false
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue({ route: 'other/help', html: '<!doctype html><p>help</p>' })
    applyWatermarkMock.mockResolvedValue(['watermarked'])

    const result = await Render('other/help', {})

    expect(applyWatermarkMock).toHaveBeenCalledWith(
      [{ type: 'image', file: 'rendered' }],
      'watermark'
    )
    expect(result).toEqual(['watermarked'])
  })
})
