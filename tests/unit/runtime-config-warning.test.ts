import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RuntimeReport } from '../../ktr/template/other/runtime/components/runtime.js'
import { runtimeConfigDegraded, runtimeStable } from '../../ktr/template/other/runtime/mock.js'
import type { RuntimeReportData } from '../../ktr/template/other/runtime/components/types.js'
import type { PosterContext } from '../../ktr/template/types/ctx.js'

/**
 * 诊断卡「配置告警」那一段的渲染护栏。
 *
 * 这一段的价值全在「平时不出现、坏了必须刺眼」这一对上，所以两个方向都要钉：
 * 正常那张卡不能凭空多出一句告警，而坏掉时文件名和原因都得真的印在图上
 * —— 少了文件名，用户看到告警也不知道该去改哪个文件。
 *
 * 顺带给 mock.ts 的两个导出上了个消费者：它们原本只有开发面板在用，
 * 契约加字段时漏改 mock 只有 `typecheck:template` 一道闸门看得见。
 */
const ctx = { scale: 1, theme: { mode: 'light' } } as unknown as PosterContext

const render = (data: RuntimeReportData) => renderToStaticMarkup(createElement(RuntimeReport, { data, ctx }))

describe('运行诊断卡的配置告警', () => {
  it('一份配置都没坏时整段不画', () => {
    const html = render(runtimeStable)

    expect(html).not.toContain('退回默认值')
    expect(html).not.toContain('cookies.yaml')
  })

  it('坏掉时印出条数、每个文件名、来源和原因', () => {
    const html = render(runtimeConfigDegraded)

    expect(html).toContain('3 份配置正在退回默认值')
    for (const entry of runtimeConfigDegraded.configHealth.files) {
      expect(html).toContain(entry.file)
      expect(html).toContain(entry.reason)
    }
    expect(html).toContain('用户配置')
    expect(html).toContain('默认模板')
  })

  it('告警排在环境摘要之前 —— 这是整张卡上唯一一处要用户动手的信息', () => {
    const html = render(runtimeConfigDegraded)
    const warning = html.indexOf('退回默认值')
    const summary = html.indexOf('环境摘要')

    // 先钉两段都在：`indexOf` 找不到时是 -1，光比大小的话「告警整段没画出来」
    // 也会让这条通过 —— 那正是本文件第一个用例在防的相反情形
    expect(warning).toBeGreaterThan(-1)
    expect(summary).toBeGreaterThan(-1)
    expect(warning).toBeLessThan(summary)
  })

  it('说清插件不会自己改这些文件，否则用户会一直等它自愈', () => {
    const html = render(runtimeConfigDegraded)

    expect(html).toContain('不会自动覆盖')
  })
})
