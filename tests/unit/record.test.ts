import { describe, expect, it } from 'vitest'

import { isRecord } from '../../src/module/utils/record.js'

/**
 * 合并前有 23 份同名实现，11 份排除数组、12 份不排除。两族都能通过类型检查，
 * 只在运行时对数组给出相反答案 —— 所以这组用例的重点就是「数组必须被拒」。
 *
 * 统一取严格版不是少数服从多数，而是有调用点把它当前提：
 * utils/YamlReader.ts 和 utils/Config.ts 的错误文案字面写着
 * 'YAML root must be a non-array record'，module/guoba/index.ts 的注释写着
 * 「数组要走点分路径分支，所以排除数组」。
 */
describe('isRecord', () => {
  it('普通对象通过', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
    expect(isRecord(Object.create(null))).toBe(true)
  })

  it('数组一律拒绝', () => {
    // 这是两族实现唯一的分歧点。宽松版在这里全返回 true，而
    // `Record<string, unknown>` 这个类型谓词对数组是撒谎的：数组的键是数字下标，
    // 按 `value.someKey` 取值只会拿到 undefined。
    expect(isRecord([])).toBe(false)
    expect(isRecord([1, 2, 3])).toBe(false)
    expect(isRecord([{ a: 1 }])).toBe(false)
  })

  it('null 和原始值拒绝', () => {
    expect(isRecord(null)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
    expect(isRecord('string')).toBe(false)
    expect(isRecord(0)).toBe(false)
    expect(isRecord(false)).toBe(false)
    expect(isRecord(Symbol('x'))).toBe(false)
    expect(isRecord(123n)).toBe(false)
  })

  it('函数拒绝（typeof 是 function 不是 object）', () => {
    expect(isRecord(() => {})).toBe(false)
    expect(isRecord(class {})).toBe(false)
  })

  it('内置对象与类实例通过 —— 判据是「不是数组的对象」，不是「字面量对象」', () => {
    // 刻意不收窄到「字面量对象」：调用点拿到的都是 JSON.parse / YAML.parse 的产物，
    // 真出现 Date 或类实例说明上游给了意外形状，那种情况该由后续的字段检查兜住，
    // 不该由这个判据顺手挡掉 —— 挡掉会让错误信息落在很远的地方。
    expect(isRecord(new Date())).toBe(true)
    expect(isRecord(new Map())).toBe(true)
    expect(isRecord(/re/)).toBe(true)
  })

  it('收窄后可以直接按字符串键取值', () => {
    const value: unknown = { nested: { deep: 1 } }
    if (!isRecord(value)) throw new Error('应当收窄成功')
    // 这行能编译过就是类型谓词生效的证明
    expect(isRecord(value.nested)).toBe(true)
  })
})
