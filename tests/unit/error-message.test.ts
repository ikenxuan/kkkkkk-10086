import { describe, expect, it } from 'vitest'

import { getErrorMessage } from '../../src/module/utils/error-message.js'

/**
 * 合并前仓库里有 6 份同名 `getErrorMessage`，两族语义：
 * - 4 份走 `error instanceof Error ? error.message : String(error)`
 * - 2 份（ErrorHandler 的 handler / sender）走鸭子类型，优先读 `.message`
 *
 * 统一取了鸭子类型那族，因为唯一一个用户可见的调用点（handler.ts 的
 * `处理失败：${...}`）本来就是这族。下面前两组用例就是两族的分歧点，
 * 钉住的是「合并没有把用户看到的字改回退化版本」。
 */
describe('getErrorMessage', () => {
  it('优先读 .message，不要求是 Error 实例', () => {
    // 这是两族的第一个分歧：instanceof 那族在这里给 '[object Object]'。
    // 适配器 throw 裸对象、以及跨 realm 的 Error（instanceof 失效）都是这个形状，
    // 而 handler.ts 会把结果直接拼进「处理失败：」回给用户。
    expect(getErrorMessage({ message: 'quota exceeded' })).toBe('quota exceeded')
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('message 为空时退回整体字符串，不返回空串', () => {
    // 第二个分歧：instanceof 那族在这里给 ''，于是用户看到的是
    // 「处理失败：」——一个只有冒号的句子。
    expect(getErrorMessage(new Error(''))).toBe('Error')
    expect(getErrorMessage({ message: '' })).toBe('[object Object]')
  })

  it('没有 message 的值按整体字符串化', () => {
    expect(getErrorMessage('plain string')).toBe('plain string')
    expect(getErrorMessage(123)).toBe('123')
    expect(getErrorMessage(undefined)).toBe('undefined')
    expect(getErrorMessage(null)).toBe('null')
    expect(getErrorMessage({ code: 500 })).toBe('[object Object]')
  })

  it('原型为 null 的对象不抛（原来 6 份全会抛）', () => {
    // `String(Object.create(null))` 抛 TypeError：没有 toString。
    // 这些调用点全在 catch 块里，helper 自己抛会把原始错误顶掉，
    // 变成一个跟真实故障无关的 TypeError。
    const bare = Object.create(null) as object

    expect(() => getErrorMessage(bare)).not.toThrow()
    expect(getErrorMessage(bare)).toBe('[object Object]')
  })

  it('message 是会抛的 getter 时不抛', () => {
    // `'message' in error` 不触发 getter，但紧接着读它就会抛。
    // 所以实现用 try + Reflect.get，而不是 in 之后直接取值。
    const hostile = Object.defineProperty({}, 'message', {
      get () {
        throw new Error('blocked getter')
      }
    })

    expect(() => getErrorMessage(hostile)).not.toThrow()
    expect(getErrorMessage(hostile)).toBe('[object Object]')
  })

  it('message 是对象时也能安全转成字符串', () => {
    expect(getErrorMessage({ message: { nested: true } })).toBe('[object Object]')
    expect(getErrorMessage({ message: 42 })).toBe('42')
  })
})
