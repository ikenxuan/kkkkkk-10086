import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..', '..')
const fontEntryPath = resolve(root, 'ktr', 'template', 'font.css')
const fontEntry = readFileSync(fontEntryPath, 'utf8')

const extractLocalFontUrls = (css: string): string[] => Array.from(
  css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g),
  match => match[2]
).filter((url): url is string => typeof url === 'string' && !/^(?:data:|https?:|\/\/)/i.test(url))

describe('React template font distribution contract', () => {
  it('uses checked-in font assets instead of the Karin font proxy', () => {
    expect(fontEntry).not.toMatch(/localhost:3780|\/config\/commonResource\/font/i)

    const localFontUrls = extractLocalFontUrls(fontEntry)
    expect(localFontUrls.length).toBeGreaterThan(0)

    for (const url of localFontUrls) {
      const assetPath = resolve(dirname(fontEntryPath), decodeURIComponent(url))
      expect(existsSync(assetPath), `missing local font asset: ${url}`).toBe(true)
    }
  })

  it('keeps generic sans and monospace fallbacks for clean systems', () => {
    expect(fontEntry).toMatch(/font-family:[^;}]*\bsans-serif\b/i)
    expect(fontEntry).toMatch(/font-family:[^;}]*\bmonospace\b/i)
  })
})
