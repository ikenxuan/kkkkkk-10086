/**
 * unknown -> 「是个普通对象」的统一判据。
 *
 * 合并前仓库里有 23 份同名实现（22 个 `isRecord` + guoba 的 `isPlainRecord`），
 * 分成两族：11 份排除数组，12 份不排除。名字和类型签名完全一样，
 * 差别只在有没有那句 `!Array.isArray(value)` —— 这种分叉最难发现，
 * 因为两族都能通过类型检查，只在运行时对数组给出相反的答案。
 *
 * 统一取**排除数组**那族，理由不是少数服从多数，而是有三处调用点把它当前提：
 * - `utils/YamlReader.ts` 和 `utils/Config.ts` 的错误文案字面写着
 *   `'YAML root must be a non-array record'`。换成宽松版，一个顶层是数组的
 *   YAML 就会被当成合法配置放过去，后面按键取值全是 undefined。
 * - `guoba.support.ts` 的注释写明「数组要走点分路径分支，所以排除数组」。
 *
 * 反过来说，`Record<string, unknown>` 这个类型谓词本身就在撒谎如果放过数组：
 * 数组的键是数字下标，按 `value.someKey` 取值只会得到 undefined。
 * 所以严格版才是与类型签名相符的那个。
 *
 * 放在 `utils/` 下的独立文件、且**零 import**，是为了让
 * `runtime/host/screenshot-options.ts` 和 `guoba.support.ts` 这两个宿主适配层
 * 也能直接引它而不引入环。它们不能走 `utils/index.js` 那个 barrel ——
 * barrel 会把 `Render` 拉进来，而 Render 依赖 `runtime/host/puppeteer`，
 * 从宿主适配层引 barrel 就绕回自己了。
 */

/**
 * 判断值是不是普通对象（不含数组、不含 null）。
 *
 * @param value 任意值，通常来自 JSON.parse / YAML.parse / 远端接口响应
 * @returns 是普通对象时收窄为 `Record<string, unknown>`
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
