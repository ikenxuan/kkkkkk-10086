/**
 * HTML 转义。
 *
 * 合并前有三份：`platform/bilibili/article.ts`、`platform/bilibili/dynamicText.ts`
 * （两者逐字节相同）和 `platform/douyin/danmaku.ts`（函数体相同，签名窄一档，
 * 只收 string）。取宽签名那版 —— `String(value ?? '')` 对字符串是恒等的，
 * 所以窄签名那批调用点行为不变。
 *
 * 为什么这件事值得合：这三处转义的都是远端内容（B站专栏正文、动态富文本、
 * 抖音弹幕文字与表情 URL），转完直接拼进交给 puppeteer 渲染的 HTML。
 * 三份各自演进的话，谁给其中一份补了字符、另两份就静默落后一档 ——
 * 而落后的那两份仍然在渲染同样不可信的内容。
 *
 * 零 import，理由同 `record.ts`：让任何层都能直接引而不引入环。
 */

/**
 * 把值转义成可安全嵌入 HTML 文本节点和属性值的字符串。
 *
 * 五个字符都必须转：`&` 要第一个转（否则会把后面转义产生的 `&` 二次转义），
 * `<` `>` 管文本节点，`"` `'` 管属性值 —— 本仓的调用点两种位置都有
 * （`alt="${escapeHtml(...)}"` 是属性，`<span>${escapeHtml(...)}</span>` 是文本）。
 *
 * @param value 任意值，通常是远端返回的文本；null / undefined 归一成空串
 * @returns 转义后的字符串
 */
export const escapeHtml = (value: string | number | undefined | null): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')
