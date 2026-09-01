/**
 * unknown -> 人类可读字符串的统一实现。
 *
 * 原来仓库里有 6 份同名 `getErrorMessage`，分成两族语义：
 * - 4 份（ImageHelper / Common / EmojiReaction / Networks）走 `error instanceof Error`
 * - 2 份（ErrorHandler 的 handler / sender）走鸭子类型，优先读 `.message`
 *
 * 这两族不等价，实测过两处分歧：
 * - `{ message: 'quota exceeded' }` 这种裸对象：鸭子类型给 `quota exceeded`，
 *   instanceof 那族给 `[object Object]`。跨 realm 的 Error（instanceof 失效）同理。
 * - `new Error('')`：instanceof 那族给空字符串，鸭子类型落到 `String(error)` 给 `Error`。
 *
 * 统一取鸭子类型那族，因为唯一一个用户可见的调用点（ErrorHandler/handler.ts
 * 的 `处理失败：${...}`）本来就是这族，改成 instanceof 会把它从
 * `处理失败：quota exceeded` 退化成 `处理失败：[object Object]`，
 * 空 message 时更是变成一个只有冒号的句子。反过来另外 5 个调用点全是打日志的，
 * 换成鸭子类型只会让日志更具体。
 *
 * 另外补了原来 6 份都没有的抗抛能力：`String(Object.create(null))` 会抛 TypeError，
 * 而这些调用点全在 catch 块里 —— 错误处理自己抛异常，会把原始错误顶掉。
 * 这跟 `ErrorHandler/render.ts` 的 `normalizeError` 早就做了的事一致。
 *
 * 不合并的两个：
 * - `ErrorHandler/render.ts` 的 `normalizeError`：返回 `{name, message, stack}`，
 *   给错误卡片用，`tests/unit/error-handler.test.ts` 锁着它的契约。
 * - `FFmpeg.ts` 的 `stringifyError`：返回的三个字段是 `string | undefined`，
 *   而那个 `undefined` 是有用的 —— `JSON.stringify` 会丢掉 undefined 属性，
 *   所以无错误时日志打出来是 `error: {}`。换成 `normalizeError` 会变成
 *   `{"name":"Error","message":"undefined","stack":""}`，是退步。
 *
 * 也就是说这三个是三件事，不是一件事的三份拷贝：本文件负责「拼进一句话」，
 * `normalizeError` 负责「填进结构化卡片」，`stringifyError` 负责「序列化进日志」。
 */

/**
 * `String()` 不是全函数：原型为 null 的对象没有 `toString`，会抛 TypeError。
 */
const stringifyUnknown = (value: unknown): string => {
  try {
    return String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

/**
 * @param error catch 到的任意值
 * @returns 可直接拼进日志或回复文本的字符串，任何输入都不抛
 */
export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    try {
      // Reflect.get 而不是 `'message' in error && error.message`：
      // message 是个会抛的 getter 时，`in` 不触发它但读取会抛
      const message = Reflect.get(error, 'message') as unknown
      if (message) return stringifyUnknown(message)
    } catch {
      // getter 抛了就当没有 message，退回下面的整体字符串化
    }
  }
  return stringifyUnknown(error)
}
