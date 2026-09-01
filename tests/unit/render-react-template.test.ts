import { beforeEach, describe, expect, it, vi } from 'vitest'

const screenshotFileMock = vi.hoisted(() => vi.fn())
const screenshotsFileMock = vi.hoisted(() => vi.fn())
const sliceTallImageMock = vi.hoisted(() => vi.fn())
const renderReactTemplateMock = vi.hoisted(() => vi.fn())
const resolveReactTemplateRouteMock = vi.hoisted(() => vi.fn())
const applyWatermarkMock = vi.hoisted(() => vi.fn())
const cleanupMock = vi.hoisted(() => vi.fn())

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
    screenshotFile: screenshotFileMock,
    screenshotsFile: screenshotsFileMock
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
  buildWatermarkText: () => 'watermark',
  // imageSlicer 从这里取读写图片字节的helper；不 mock 会 No "readImageBytes" export
  readImageBytes: () => null,
  replaceImageBytes: (image: unknown) => image
}))

vi.mock('../../src/module/utils/imageSlicer.js', () => ({
  sliceTallImage: sliceTallImageMock
}))

vi.mock('../../src/module/utils/react-template/index.js', () => ({
  renderReactTemplate: renderReactTemplateMock,
  resolveReactTemplateRoute: resolveReactTemplateRouteMock
}))

globalThis.logger = {
  error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), mark: vi.fn()
} as unknown as typeof logger

const { Render } = await import('../../src/module/utils/Render.js')
type ReactTemplateRoute = import('../../src/module/utils/react-template/types.js').ReactTemplateRoute

/**
 * standalone 运行时把文档写进自己的一次性目录，再把路径和清理函数一起交回来。
 * Render 不再拿到 HTML 字符串，所以这里模拟的是路径 + cleanup 这一对。
 */
const RENDERED_HTML_PATH = 'E:/Yunzai/temp/html/kkkkkk-10086-ktr-a1b2c3/index.html'
const renderedTemplate = (route = 'other/help') => ({
  route,
  htmlPath: RENDERED_HTML_PATH,
  cleanup: cleanupMock
})

beforeEach(() => {
  screenshotFileMock.mockReset()
  screenshotsFileMock.mockReset()
  renderReactTemplateMock.mockReset()
  resolveReactTemplateRouteMock.mockReset()
  applyWatermarkMock.mockReset()
  cleanupMock.mockReset()
  configMock.app.RemoveWatermark = true
  configMock.app.multiPageRender = true
  cleanupMock.mockResolvedValue(undefined)
  screenshotFileMock.mockResolvedValue({ type: 'image', file: 'single-rendered' })
  screenshotsFileMock.mockResolvedValue([{ type: 'image', file: 'rendered' }])
  sliceTallImageMock.mockReset()
  sliceTallImageMock.mockImplementation(async (image: unknown) => [image])
})

describe('Render React template routing', () => {
  it('sends a standalone React HTML file to the Yunzai Puppeteer host', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue(renderedTemplate())

    const params = { title: 'Help' }
    const result = await Render('other/help', params)

    expect(renderReactTemplateMock).toHaveBeenCalledWith(
      'other/help',
      params,
      expect.objectContaining({
        scale: 1,
        theme: { mode: 'dark' },
        version: undefined
      })
    )
    const rendererData = renderReactTemplateMock.mock.calls[0]?.[1]
    expect(rendererData).toBe(params)
    expect(rendererData).toEqual({ title: 'Help' })
    expect(rendererData).not.toHaveProperty('useDarkTheme')
    // 一律走单图接口且 multiPage 必须是 false：宿主见到它为真就把 imgType 覆盖成 jpeg，
    // 卡片圆角外那圈透明像素会被合成成纯白。分片改由 sliceTallImage 自己做。
    expect(screenshotFileMock).toHaveBeenCalledWith(
      'kkkkkk-10086/react/other/help',
      RENDERED_HTML_PATH,
      expect.objectContaining({
        saveId: expect.stringMatching(/^help-[0-9a-f-]{36}$/),
        imgType: 'png',
        omitBackground: true,
        multiPage: false,
        pageGotoParams: { waitUntil: 'load', timeout: 30000 }
      })
    )
    expect(screenshotsFileMock).not.toHaveBeenCalled()
    expect(sliceTallImageMock).toHaveBeenCalledWith({ type: 'image', file: 'single-rendered' }, 9000)
    expect(cleanupMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([{ type: 'image', file: 'single-rendered' }])
  })

  it('injects Config.app.ambientCover into the React template context', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue(renderedTemplate())

    await Render('other/help')

    expect(renderReactTemplateMock).toHaveBeenCalledWith(
      'other/help',
      expect.any(Object),
      expect.objectContaining({ ambientCover: configMock.app.ambientCover })
    )
  })

  it('skips slicing when pagination is disabled', async () => {
    configMock.app.multiPageRender = false
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue(renderedTemplate())

    const result = await Render('other/help')

    expect(screenshotFileMock).toHaveBeenCalledWith(
      'kkkkkk-10086/react/other/help',
      RENDERED_HTML_PATH,
      expect.objectContaining({ multiPage: false, imgType: 'png', omitBackground: true })
    )
    expect(screenshotsFileMock).not.toHaveBeenCalled()
    // multiPageRender: false 的语义是「不要分片」，整张发出去
    expect(sliceTallImageMock).not.toHaveBeenCalled()
    expect(result).toEqual([{ type: 'image', file: 'single-rendered' }])
  })

  it('sends every slice when the capture is taller than multiPageHeight', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue(renderedTemplate())
    sliceTallImageMock.mockResolvedValue([
      { type: 'image', file: 'slice-0' },
      { type: 'image', file: 'slice-1' }
    ])

    const result = await Render('other/help')

    expect(result).toEqual([
      { type: 'image', file: 'slice-0' },
      { type: 'image', file: 'slice-1' }
    ])
  })

  it('uses a distinct Puppeteer save id for concurrent renders of one route', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue(renderedTemplate())

    await Promise.all([Render('other/help'), Render('other/help')])

    const first = screenshotFileMock.mock.calls[0]?.[2] as { saveId: string }
    const second = screenshotFileMock.mock.calls[1]?.[2] as { saveId: string }
    expect(first.saveId).not.toBe(second.saveId)
    expect(cleanupMock).toHaveBeenCalledTimes(2)
  })

  it('rejects an unregistered route instead of falling back to art-template', async () => {
    resolveReactTemplateRouteMock.mockReturnValue(undefined)

    // 故意绕过类型：`Render` 的第一个参数现在收窄成 ReactTemplateRoute，写死的野路由
    // 编译期就会红。但运行时那道 `if (!reactRoute) throw` 仍然要留着 —— 纯 JS 调用方、
    // 或者路由从表里删了而调用点还在，都只能靠它兜住，所以这里 cast 一下继续测运行时行为。
    await expect(Render('admin/index' as ReactTemplateRoute, { data: { ok: true } })).rejects.toThrow(
      '[Render] 未注册 React 模板路由：admin/index'
    )

    expect(renderReactTemplateMock).not.toHaveBeenCalled()
    expect(screenshotsFileMock).not.toHaveBeenCalled()
  })

  it('propagates React HTML generation failures without a legacy fallback', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockRejectedValue(new Error('registry unavailable'))

    await expect(Render('other/help', { title: 'Help' })).rejects.toThrow(
      '[Render] React SSR 渲染失败（other/help）：registry unavailable'
    )

    // 渲染自身失败时 registry 已在内部清理过临时目录，Render 拿不到 cleanup 也不该调用。
    expect(cleanupMock).not.toHaveBeenCalled()
    expect(screenshotsFileMock).not.toHaveBeenCalled()
  })

  it('removes the standalone temp directory even when the screenshot throws', async () => {
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue(renderedTemplate())
    screenshotFileMock.mockRejectedValue(new Error('puppeteer crashed'))

    await expect(Render('other/help')).rejects.toThrow('puppeteer crashed')

    // 没有这个 finally，每次截图失败都会在 temp/html 下留一个孤儿目录，
    // 长期运行的 Bot 会把磁盘慢慢填满。
    expect(cleanupMock).toHaveBeenCalledTimes(1)
  })

  it('returns false without legacy fallback or watermarking when a React capture fails', async () => {
    configMock.app.RemoveWatermark = false
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue(renderedTemplate())
    screenshotFileMock.mockResolvedValue(false)

    const result = await Render('other/help')

    expect(result).toBe(false)
    expect(screenshotFileMock).toHaveBeenCalledTimes(1)
    expect(screenshotFileMock.mock.calls[0]?.[0]).toBe('kkkkkk-10086/react/other/help')
    expect(cleanupMock).toHaveBeenCalledTimes(1)
    expect(applyWatermarkMock).not.toHaveBeenCalled()
  })

  it('preserves the existing watermark pipeline after React screenshots', async () => {
    configMock.app.RemoveWatermark = false
    resolveReactTemplateRouteMock.mockReturnValue('other/help')
    renderReactTemplateMock.mockResolvedValue(renderedTemplate())
    applyWatermarkMock.mockResolvedValue(['watermarked'])

    const result = await Render('other/help', {})

    expect(renderReactTemplateMock).toHaveBeenCalledWith(
      'other/help',
      {},
      expect.objectContaining({
        version: expect.objectContaining({
          pluginName: 'kkkkkk-10086',
          poweredBy: 'TRSS-Yunzai',
          frameworkVersion: '3.1.0'
        })
      })
    )
    expect(applyWatermarkMock).toHaveBeenCalledWith(
      [{ type: 'image', file: 'single-rendered' }],
      'watermark'
    )
    expect(result).toEqual(['watermarked'])
  })
})
