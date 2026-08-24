import { describe, expect, it } from 'vitest'

import { escapeHtml } from '../../src/module/utils/html.js'

/**
 * 合并前有三份：bilibili/article.ts 与 bilibili/dynamicText.ts 逐字节相同，
 * douyin/danmaku.ts 函数体相同但签名只收 string。三处转义的都是远端内容
 * （专栏正文、动态富文本、弹幕文字与表情 URL），转完直接拼进交给 puppeteer
 * 渲染的 HTML —— 三份各自演进的话，谁补了字符另两份就静默落后一档。
 */
describe('escapeHtml', () => {
  it('五个字符都转', () => {
    expect(escapeHtml('&')).toBe('&amp;')
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('>')).toBe('&gt;')
    expect(escapeHtml('"')).toBe('&quot;')
    expect(escapeHtml("'")).toBe('&#39;')
  })

  it('& 必须第一个转，否则会把自己产生的实体二次转义', () => {
    // 如果 & 放在最后转，`<` 先变成 `&lt;`，再被 & 规则改成 `&amp;lt;`，
    // 页面上就会显示字面的 "&lt;" 而不是 "<"。这条钉住替换顺序。
    expect(escapeHtml('<a>')).toBe('&lt;a&gt;')
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
  })

  it('闭合属性值的尝试被中和', () => {
    // 调用点里有 `alt="${escapeHtml(...)}"` 这种属性位置，
    // 远端标题带一个双引号就能逃出属性、接着写 onerror
    expect(escapeHtml('" onerror="alert(1)')).toBe('&quot; onerror=&quot;alert(1)')
    expect(escapeHtml("' onerror='alert(1)")).toBe('&#39; onerror=&#39;alert(1)')
  })

  it('标签注入被中和', () => {
    expect(escapeHtml('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escapeHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('null / undefined 归一成空串，数字照常转成文本', () => {
    // 宽签名那版的行为。合并前 danmaku.ts 那份只收 string，
    // 换到宽签名后它的调用点行为不变（String(s ?? '') 对字符串是恒等的）。
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(0)).toBe('0')
    expect(escapeHtml(42)).toBe('42')
  })

  it('不该动的字符原样保留', () => {
    // 反引号和斜杠不在名单里：本仓的调用点都把值放进带引号的属性或文本节点，
    // 这两个字符在那两种位置都无法逃出去。真出现需要它们的位置（比如拼进
    // 内联 script 或未加引号的属性），该做的是别那么拼，而不是加转义。
    expect(escapeHtml('a`b/c')).toBe('a`b/c')
    expect(escapeHtml('中文 emoji 🎬')).toBe('中文 emoji 🎬')
    expect(escapeHtml('https://x.com/a?b=1&c=2')).toBe('https://x.com/a?b=1&amp;c=2')
  })
})
