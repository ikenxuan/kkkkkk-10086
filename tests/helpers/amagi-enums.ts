import { createRequire } from 'node:module'
import { resolve } from 'node:path'

/**
 * 真包的 amagi 枚举表，给 `vi.mock('.../amagiClient.js')` 的工厂补 `loadAmagiEnums`。
 *
 * 这些用例挡掉 `amagiClient` 是为了不让 fetcher 发真请求，但 `bilibili.ts` 与
 * `push.ts` 在模块作用域就把枚举解构出来了（`const { DynamicType } = loadAmagiEnums()`），
 * 工厂缺这一项直接是 `No "loadAmagiEnums" export is defined`。
 *
 * 这里返回**真包**而不是手写副本：手写副本没有任何编译期约束，上游改名后用例照样绿，
 * 而按名字读枚举正是 `tests/contracts/amagi-enums.test.ts` 在守的那件事。
 *
 * `require` 的两级与 `utils/amagiClient.ts` 的 `loadAmagiEnums` 一致：vitest 下裸
 * require 会命中 amagi exports 的 `development` 条件、解析到未发布的 `src/index.ts`，
 * 所以从稳定导出的 `axios` 子路径反推 CJS 产物。
 */
const require = createRequire(import.meta.url)

export const loadRealAmagiEnums = (): unknown => {
  try {
    return require('@ikenxuan/amagi')
  } catch {
    const axiosEntry = require.resolve('@ikenxuan/amagi/axios')
    return require(resolve(axiosEntry, '../../default/index.cjs'))
  }
}
