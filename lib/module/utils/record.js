/**
 * 接口响应的安全取值原语：`isRecord`（unknown -> 普通对象）、
 * `at`（安全取数组元素）、`firstUrl`（从 url_list 取第一个可用地址）。
 *
 * 三个都只回答「这个值到底在不在」，都零 import，所以放同一个文件。
 *
 * 合并前仓库里有 23 份同名实现（22 个 `isRecord` + guoba 的 `isPlainRecord`），
 * 分成两族：11 份排除数组，12 份不排除。名字和类型签名完全一样，
 * 差别只在有没有那句 `!Array.isArray(value)` —— 这种分叉最难发现，
 * 因为两族都能通过类型检查，只在运行时对数组给出相反的答案。
 *
 * 统一取**排除数组**那族，理由不是少数服从多数，而是有两处调用点把它当前提：
 * - `utils/YamlReader.ts` 和 `utils/Config.ts` 的错误文案字面写着
 *   `'YAML root must be a non-array record'`。换成宽松版，一个顶层是数组的
 *   YAML 就会被当成合法配置放过去，后面按键取值全是 undefined。
 *
 * 反过来说，`Record<string, unknown>` 这个类型谓词本身就在撒谎如果放过数组：
 * 数组的键是数字下标，按 `value.someKey` 取值只会得到 undefined。
 * 所以严格版才是与类型签名相符的那个。
 *
 * 放在 `utils/` 下的独立文件、且**零 import**，是为了让
 * `runtime/host/screenshot-options.ts` 和 `module/guoba/index.ts` 这两个宿主适配层
 * 也能直接引它而不引入环。它们不能走 `utils/index.js` 那个 barrel ——
 * barrel 会把 `Render` 拉进来，而 Render 依赖 `runtime/host/puppeteer`，
 * 从宿主适配层引 barrel 就绕回自己了。
 */
/**
 * @param value 任意值，通常来自 JSON.parse / YAML.parse / 远端接口响应
 * @returns 是普通对象时收窄为 `Record<string, unknown>`
 */
export const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/**
 * 安全取数组元素：数组本身不存在、或下标越界，都返回 undefined。
 *
 * 存在的理由不是「少写一个可选链」，而是 `tsconfig.json` 的 `noUncheckedIndexedAccess`
 * **对元组不生效**：`[T, ...T[]]` 这种非空元组的 0 号位在类型上永远不带 `undefined`，
 * 于是 `list[0].play_addr` 能穿过 lint 与全部 typecheck，只在上游删字段时于线上炸成
 * `Cannot read properties of undefined (reading '0')`。这个函数的签名把入参放宽到
 * `readonly T[] | null | undefined`、返回值收紧到 `T | undefined`，
 * 让「数组可能整个不存在」这件事变成调用点必须处理的类型事实。
 *
 * @param list 可能不存在的数组，通常直接来自接口响应
 * @param index 下标，默认 0（绝大多数调用点取的就是第一个）
 * @returns 取到的元素；数组缺失或下标越界时为 undefined
 */
export const at = (list, index = 0) => Array.isArray(list) ? list[index] : undefined;
/**
 * 从「一份资源多个 CDN 地址」的对象里取第一个可用地址。
 *
 * 抖音/B站的 `url_list` 有三种坏形态：整个字段缺失、给了空数组、数组里混着空串。
 * 三者都要落到同一个兜底值上，所以判据是 `find(Boolean)` 而不是 `[0]` ——
 * 后者在「首位是空串」时会返回空串，把兜底链整条短路掉。
 *
 * 入参故意不收 `UrlResource`：调用点分散在抖音/B站/快手各自的类型里，
 * 形状相同但名字不同，收窄成某一个会逼着调用点写断言。
 *
 * @param resource 带 `url_list` 的资源对象，允许整个不存在
 * @returns 第一个非空地址；一个都没有时返回空字符串
 */
export const firstUrl = (resource) => resource?.url_list?.find(Boolean) ?? '';
