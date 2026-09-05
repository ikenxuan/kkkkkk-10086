import { beforeEach, describe, expect, it } from 'vitest'

import {
  getDegradedConfigSnapshot,
  recordConfigParseFailure,
  recordConfigParseSuccess,
  resetConfigHealth
} from '../../src/module/utils/configHealth.js'

/**
 * 配置解析登记处的护栏。
 *
 * 这个模块存在的唯一理由是「坏掉的配置文件不再无声无息」，所以两条最要紧的账是：
 * 改好之后名单要摘干净（否则诊断卡永远挂着一个已经修好的告警），
 * 以及原因必须压成一行（YAML 的报错自带源码片段和箭头，多行会把卡上版式挤垮）。
 */
const USER_REQUEST = 'E:/Yunzai/plugins/kkkkkk-10086/config/config/request.yaml'
const USER_COOKIES = 'E:/Yunzai/plugins/kkkkkk-10086/config/config/cookies.yaml'
const DEFAULT_REQUEST = 'E:/Yunzai/plugins/kkkkkk-10086/config/default_config/request.yaml'

beforeEach(() => {
  resetConfigHealth()
})

describe('配置解析登记', () => {
  it('一份都没坏时快照是空数组', () => {
    expect(getDegradedConfigSnapshot()).toEqual([])
  })

  it('登记失败时拆出文件名和所在目录', () => {
    recordConfigParseFailure(USER_REQUEST, new Error('boom'))

    expect(getDegradedConfigSnapshot()).toEqual([
      { file: 'request.yaml', directory: 'config', reason: 'boom' }
    ])
  })

  it('用目录名区分用户配置和默认模板，两者能同时在名单里', () => {
    recordConfigParseFailure(USER_REQUEST, new Error('用户那份坏了'))
    recordConfigParseFailure(DEFAULT_REQUEST, new Error('模板那份也坏了'))

    expect(getDegradedConfigSnapshot().map(entry => entry.directory)).toEqual(['config', 'default_config'])
  })

  it('同一个文件反复失败只留最后一次原因，不会堆成两条', () => {
    recordConfigParseFailure(USER_REQUEST, new Error('第一次'))
    recordConfigParseFailure(USER_REQUEST, new Error('第二次'))

    expect(getDegradedConfigSnapshot()).toEqual([
      { file: 'request.yaml', directory: 'config', reason: '第二次' }
    ])
  })

  it('改好之后把登记摘掉，否则诊断卡会一直挂着修好的告警', () => {
    recordConfigParseFailure(USER_REQUEST, new Error('boom'))
    recordConfigParseSuccess(USER_REQUEST)

    expect(getDegradedConfigSnapshot()).toEqual([])
  })

  it('摘登记只认同一个路径，不会顺手清掉别的文件', () => {
    recordConfigParseFailure(USER_REQUEST, new Error('boom'))
    recordConfigParseSuccess(USER_COOKIES)

    expect(getDegradedConfigSnapshot().map(entry => entry.file)).toEqual(['request.yaml'])
  })

  it('按文件名排序，跟登记先后无关', () => {
    recordConfigParseFailure(USER_REQUEST, new Error('boom'))
    recordConfigParseFailure(USER_COOKIES, new Error('boom'))

    expect(getDegradedConfigSnapshot().map(entry => entry.file)).toEqual(['cookies.yaml', 'request.yaml'])
  })
})

describe('原因压成一行', () => {
  it('只取 YAML 报错的第一行，源码片段和箭头都不进卡片', () => {
    // yaml 包真实抛出来的形状：第一行是结论，后面跟着源码片段和一行 `^` 指示
    recordConfigParseFailure(
      USER_REQUEST,
      new Error('Implicit keys need to be on a single line at line 22, column 1:\n\n\u5668\u7aef\u53e3\n^\n')
    )

    expect(getDegradedConfigSnapshot()[0]?.reason).toBe(
      'Implicit keys need to be on a single line at line 22, column 1:'
    )
  })

  it('抛的不是 Error 也能读出一句话', () => {
    recordConfigParseFailure(USER_REQUEST, 'plain string failure')

    expect(getDegradedConfigSnapshot()[0]?.reason).toBe('plain string failure')
  })

  it('原因为空时给占位符，不在卡上留一片空白', () => {
    recordConfigParseFailure(USER_REQUEST, new Error('   \n第二行不该被拿来顶替'))

    expect(getDegradedConfigSnapshot()[0]?.reason).toBe('未知原因')
  })
})
