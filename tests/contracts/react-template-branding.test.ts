import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..', '..')
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8')
const readOptionalSource = (path: string) => {
  const absolutePath = resolve(root, path)
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : ''
}

const defaultLayout = readSource('ktr/template/components/DefaultLayout.tsx')
const handlerError = readSource('ktr/template/other/handlerError/components/handlerError.tsx')
const versionWarning = readSource('ktr/template/other/version_warning/components/VersionWarning.tsx')
const changelog = readSource('ktr/template/other/changelog/components/changelog.tsx')
const qrLogin = readSource('ktr/template/other/qrlogin/components/qrlogin.tsx')
const livePhotoTip = readSource('ktr/template/other/live-photo-tip/components/LivePhotoTip.tsx')
const runtime = readSource('ktr/template/other/runtime/components/runtime.tsx')
const pluginLogo = readOptionalSource('resources/image/kkkkkk-logo.svg')
const frameworkLogo = readOptionalSource('resources/image/yunzai-logo.svg')

const legacyKarinPluginLogoPath = 'M132.75,87.37l-53.72-53.37'

describe('React template branding contract', () => {
  it('preserves the karin-plugin-kkk layout geometry without applying scale twice', () => {
    expect(defaultLayout).toContain(
      'relative w-360 shrink-0 overflow-hidden rounded-[5rem] bg-background bg-clip-padding text-foreground font-[HarmonyOSHans-Regular]'
    )
    expect(defaultLayout).toContain('relative z-50 pt-32 pb-20 text-foreground/80')
    expect(defaultLayout).toContain('flex relative justify-center items-center space-x-8')
    expect(defaultLayout).toContain('imgClassName="w-auto h-18"')
    expect(defaultLayout).toContain('text-5xl font-black')
    expect(defaultLayout).toContain('w-1 h-14')
    expect(defaultLayout).not.toMatch(/\bzoom\s*:/)
  })

  it('uses dedicated plugin and Yunzai assets in the shared footer', () => {
    expect(defaultLayout).toContain('src="/image/kkkkkk-logo.svg"')
    expect(defaultLayout).toContain('alt="kkkkkk-10086"')
    expect(defaultLayout).toContain('src="/image/yunzai-logo.svg"')
    expect(defaultLayout).toContain('alt="Yunzai"')
    expect(defaultLayout).not.toContain('/image/frame-logo.png')
    expect(defaultLayout).not.toContain(legacyKarinPluginLogoPath)
  })

  it('keeps error and version-warning branding consistent with the shared footer', () => {
    for (const source of [handlerError, versionWarning]) {
      expect(source).toContain('/image/kkkkkk-logo.svg')
      expect(source).not.toContain(legacyKarinPluginLogoPath)
    }
    expect(handlerError).toContain('/image/yunzai-logo.svg')
    expect(handlerError).not.toContain('/image/frame-logo.png')
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
      expect(source).toContain('/image/kkkkkk-logo.svg')
      expect(source).toContain('YUNZAI-PLUGIN')
      expect(source).not.toContain('KARIN-PLUGIN')
      expect(source).not.toContain('karin-plugin-kkk')
      expect(source).not.toContain(legacyKarinPluginLogoPath)
    }

    expect(qrLogin).toContain('kkkkkk-10086')
    expect(runtime).toContain('Yunzai 版本')
    expect(runtime).not.toContain('Karin 版本')
  })

  it('ships font-independent accessible SVG artwork for both brands', () => {
    expect(pluginLogo).toContain('<title id="kkkkkk-logo-title">kkkkkk-10086</title>')
    expect(pluginLogo).toContain('aria-labelledby="kkkkkk-logo-title"')
    expect(frameworkLogo).toContain('<title id="yunzai-logo-title">Yunzai</title>')
    expect(frameworkLogo).toContain('aria-labelledby="yunzai-logo-title"')

    for (const logo of [pluginLogo, frameworkLogo]) {
      expect(logo).toContain('<svg')
      expect(logo).toContain('viewBox="0 0 256 256"')
      expect(logo).not.toContain('<text')
    }
  })
})
