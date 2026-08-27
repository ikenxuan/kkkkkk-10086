import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..', '..')
const templateRoot = resolve(root, 'ktr')
const imageRoot = resolve(root, 'resources', 'image')

const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8')

const DEFAULT_LAYOUT = 'ktr/template/components/DefaultLayout.tsx'
const HANDLER_ERROR = 'ktr/template/other/handlerError/components/handlerError.tsx'
const VERSION_WARNING = 'ktr/template/other/version_warning/components/VersionWarning.tsx'
const QR_LOGIN = 'ktr/template/other/qrlogin/components/qrlogin.tsx'
const LIVE_PHOTO_TIP = 'ktr/template/other/live-photo-tip/components/LivePhotoTip.tsx'
const KKK_LOGO = 'ktr/template/components/KkkLogo.tsx'
const CHANGELOG = 'ktr/template/other/changelog/components/changelog.tsx'
const RUNTIME = 'ktr/template/other/runtime/components/runtime.tsx'

/** 插件品牌图（PNG）：页脚改用矢量图后，只剩 version_warning 和 qrlogin 两张自绘页脚的海报还在用 */
const PLUGIN_LOGO = '/image/logo.png'
/** 云崽框架品牌图 */
const FRAMEWORK_LOGO = '/image/frame-logo.png'
/** 页脚改版前用过的矢量品牌图文件，现在已经零引用 */
const RETIRED_LOGOS = ['kkkkkk-logo.svg', 'yunzai-logo.svg']
/**
 * kkk 矢量品牌图的路径数据（照搬上游 DefaultLayout）。
 *
 * 整个 ktr/ 里只允许出现在 components/KkkLogo.tsx 这一个文件：需要它的模板一律 import
 * 那个共享组件（现在是 DefaultLayout 的共享页脚和 live-photo-tip 的自绘页脚两处）。
 * 路径数据一旦散落到多个文件，以后换 logo 就得改多处，必然漏一处、图上出现两个版本的品牌。
 */
const INLINE_PLUGIN_LOGO_PATH_DATA = 'M132.75,87.37l-53.72-53.37'
/** 共享矢量品牌组件的渲染点：路径数据搬走以后，用它来定位「这里画了 kkk 的 logo」 */
const KKK_LOGO_TAG = '<KkkLogo'
/** 自绘品牌的模板用这个 ctx 覆写关掉 DefaultLayout 的页脚 */
const FOOTER_SUPPRESSION = /ctx=\{\{\s*\.\.\.props\.ctx,\s*version:\s*undefined\s*\}\}/

const defaultLayout = readSource(DEFAULT_LAYOUT)
const handlerError = readSource(HANDLER_ERROR)
const versionWarning = readSource(VERSION_WARNING)
const qrLogin = readSource(QR_LOGIN)
const livePhotoTip = readSource(LIVE_PHOTO_TIP)
const changelog = readSource(CHANGELOG)
const runtime = readSource(RUNTIME)

const countOf = (source: string, needle: string) => source.split(needle).length - 1

const collectTemplateFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry): string[] => {
    const target = resolve(directory, entry.name)
    if (entry.isDirectory()) return collectTemplateFiles(target)
    return /\.(?:tsx?|css)$/.test(entry.name) ? [target] : []
  })

const templateSources = collectTemplateFiles(templateRoot).map(file => ({
  file: relative(root, file).split('\\').join('/'),
  source: readFileSync(file, 'utf8')
}))

/** 注释里的资源路径不会被渲染，所以扫描前先剥掉，避免把注释当成契约 */
const stripComments = (source: string) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[\s(,{[;])\/\/[^\n]*/gm, '$1')

interface AssetReference {
  /** 引用它的模板文件（仓库相对路径） */
  file: string
  /** 以 /image/ 开头的站内资源路径，可能含模板字符串插值 */
  path: string
}

const assetReferences: AssetReference[] = templateSources.flatMap(({ file, source }) => {
  const pattern = /(["'`])(\/image\/[^"'`\n)]*)\1|url\(\s*(\/image\/[^)\s'"]*)\s*\)/g
  const found: AssetReference[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(stripComments(source))) !== null) {
    found.push({ file, path: match[2] ?? match[3] })
  }
  return found
})

const filesReferencing = (assetPath: string) =>
  [...new Set(assetReferences.filter(reference => reference.path === assetPath).map(reference => reference.file))].sort()

/** 逐段比对目录列表，这样 Windows 上写错大小写也会在这里失败，而不是等到 Linux 上渲染出空图 */
const resolveExactly = (segments: string[]) => {
  let current = imageRoot
  for (const segment of segments) {
    if (!readdirSync(current).includes(segment)) return undefined
    current = resolve(current, segment)
  }
  return current
}

describe('React template branding contract', () => {
  it('keeps the plugin and framework brand pair exclusive to the shared layout footer', () => {
    // 页脚的插件品牌图已从 /image/logo.png 换成矢量图（页脚整段照搬上游 DefaultLayout，
    // 同时满足「页脚换成 kkkk 的 svg」这条要求），PNG 只留给自绘品牌的那两张海报。
    // 矢量图走共享组件，路径数据不再内联在这里。
    expect(defaultLayout).not.toContain(INLINE_PLUGIN_LOGO_PATH_DATA)
    expect(defaultLayout).toContain("from './KkkLogo'")
    expect(countOf(defaultLayout, KKK_LOGO_TAG)).toBe(1)
    expect(defaultLayout).not.toContain(PLUGIN_LOGO)

    expect(defaultLayout).toContain(`src="${FRAMEWORK_LOGO}"`)
    expect(countOf(defaultLayout, FRAMEWORK_LOGO)).toBe(1)
    // 框架名走 version.poweredBy（本仓库填 Yunzai），不写死在模板里，
    // 所以照搬上游也不会把 Karin 的字样带进来。
    expect(defaultLayout).toContain('{version.poweredBy}')
    expect(defaultLayout).not.toMatch(/Karin/)

    expect(filesReferencing(FRAMEWORK_LOGO)).toEqual([DEFAULT_LAYOUT])
  })

  it('renders the branded footer only when ctx.version is truthy', () => {
    expect(defaultLayout).toMatch(/const \{ version[^}]*\} = ctx/)

    // 上游页脚的外层是普通 div 而不是 <footer>，所以按 version 三元的结构定位区间，
    // 换 wrapper 标签不会让这条契约失效。两个分隔符在文件里都只出现一次。
    const footerStart = defaultLayout.indexOf('{version ? (')
    const footerEnd = defaultLayout.indexOf(') : (', footerStart)
    expect(footerStart).toBeGreaterThan(0)
    expect(footerEnd).toBeGreaterThan(footerStart)

    const footer = defaultLayout.slice(footerStart, footerEnd)
    expect(footer).toContain(KKK_LOGO_TAG)
    expect(footer).toContain(FRAMEWORK_LOGO)

    // ctx.version 为空时走的分支只放水印 ID，任何品牌图形出现在这里都说明页脚没被真正关掉
    const fallback = defaultLayout.slice(footerEnd)
    expect(fallback).not.toContain('/image/')
    expect(fallback).not.toContain(KKK_LOGO_TAG)
  })

  it('never draws a second brand pair inside the error poster', () => {
    // handlerError 保留 DefaultLayout 的页脚（ctx 原样透传），自绘一份品牌对会让同一张图出现两组
    expect(handlerError).toContain('ctx={props.ctx}')
    expect(handlerError).not.toMatch(FOOTER_SUPPRESSION)

    expect(handlerError).not.toContain(PLUGIN_LOGO)
    expect(handlerError).not.toContain(FRAMEWORK_LOGO)

    const errorAssets = assetReferences.filter(reference => reference.file === HANDLER_ERROR)
    expect(errorAssets.length).toBeGreaterThan(0)
    for (const reference of errorAssets) {
      expect(reference.path).toMatch(/^\/image\/other\/handlerError\//)
    }
  })

  it('lets self-branded posters draw the plugin mark only while suppressing the footer', () => {
    // PNG 品牌图只剩这两张自绘页脚的海报在用
    expect(filesReferencing(PLUGIN_LOGO)).toEqual(
      [VERSION_WARNING, QR_LOGIN].sort()
    )

    for (const source of [versionWarning, qrLogin]) {
      expect(source).toContain(PLUGIN_LOGO)
    }

    // live-photo-tip 的页脚换成了共享的矢量组件：既不引 PNG，也不自己内联一份路径数据
    expect(livePhotoTip).not.toContain(PLUGIN_LOGO)
    expect(livePhotoTip).not.toContain(INLINE_PLUGIN_LOGO_PATH_DATA)
    expect(livePhotoTip).toContain("from '../../../components/KkkLogo'")
    expect(livePhotoTip).toContain(KKK_LOGO_TAG)

    // 自绘页脚的模板必须同时用 ctx 覆写关掉 DefaultLayout 的页脚，否则同一张图上出现两组品牌
    for (const source of [versionWarning, qrLogin, livePhotoTip]) {
      expect(source).toMatch(FOOTER_SUPPRESSION)
      expect(source).not.toContain(FRAMEWORK_LOGO)
    }
  })

  it('leaves no template on the retired svg brand artwork', () => {
    for (const logo of RETIRED_LOGOS) {
      expect(filesReferencing(`/image/${logo}`)).toEqual([])
      expect(templateSources.filter(({ source }) => source.includes(logo)).map(({ file }) => file)).toEqual([])
    }

    // kkk 矢量图的路径数据只允许待在共享组件 KkkLogo.tsx 里，抄第二份出去就等于埋下两版品牌
    expect(templateSources.filter(({ source }) => source.includes(INLINE_PLUGIN_LOGO_PATH_DATA)).map(({ file }) => file))
      .toEqual([KKK_LOGO])
  })

  it('resolves every template image path to a real file under resources/image', () => {
    expect(templateSources.length).toBeGreaterThan(50)
    expect(assetReferences.length).toBeGreaterThan(20)

    const unresolved = assetReferences.filter(({ path }) => {
      const withoutPrefix = path.replace(/^\/image\//, '')
      const interpolation = withoutPrefix.indexOf('${')
      // 路径里带插值时只能校验静态前缀那一段目录，例如 level/lv${level}.svg 校验 level/
      const segments = interpolation >= 0
        ? withoutPrefix.slice(0, withoutPrefix.lastIndexOf('/', interpolation)).split('/').filter(Boolean)
        : withoutPrefix.split('/')
      const target = segments.length > 0 ? resolveExactly(segments) : undefined
      if (!target) return true
      return interpolation >= 0 ? !statSync(target).isDirectory() : !statSync(target).isFile()
    })

    expect(unresolved).toEqual([])
  })

  it('routes error-report help to this Yunzai port instead of the Karin upstream', () => {
    expect(handlerError).toContain('https://github.com/ikenxuan/kkkkkk-10086/issues/new/choose')
    expect(handlerError).toContain('https://github.com/ikenxuan/kkkkkk-10086')
    expect(handlerError).not.toContain('https://github.com/ikenxuan/karin-plugin-kkk')
  })

  it('uses Yunzai and Guoba branding in every user-visible utility poster', () => {
    expect(changelog).toContain('锅巴')
    expect(changelog).toContain('git pull')
    expect(changelog).not.toMatch(/Karin WebUI|Karin 根目录|karin-plugin-kkk/)

    for (const source of [qrLogin, livePhotoTip]) {
      expect(source).toContain('YUNZAI-PLUGIN')
      expect(source).not.toContain('KARIN-PLUGIN')
      expect(source).not.toContain('karin-plugin-kkk')
    }

    expect(qrLogin).toContain('kkkkkk-10086')
    expect(runtime).toContain('Yunzai 版本')
    expect(runtime).not.toContain('Karin 版本')
  })
})
