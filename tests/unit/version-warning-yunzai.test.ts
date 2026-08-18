import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { VersionWarning } from '../../ktr/template/other/version_warning/components/VersionWarning.js'

describe('Yunzai version warning template', () => {
  it('renders Yunzai ecosystem guidance instead of Karin-only upgrade instructions', () => {
    const html = renderToStaticMarkup(createElement(VersionWarning, {
      data: {
        requireVersion: '3.1.0',
        currentVersion: '3.0.0'
      },
      ctx: { scale: 1, theme: { mode: 'light' } }
    }))

    expect(html).toContain('Yunzai')
    expect(html).toContain('锅巴')
    expect(html).toContain('Miao-Yunzai')
    expect(html).toContain('TRSS-Yunzai')
    expect(html).not.toContain('node-karin')
    expect(html).not.toContain('karin-plugin-basic')
    expect(html).not.toContain('Karin Web')
    expect(html).not.toContain('pnpm add node-karin')
  })
})
