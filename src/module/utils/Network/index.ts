/**
 * 网络层的公开面。
 *
 * 目录里其余模块都是这一层的内部实现，外面只认这个 barrel —— 想深链
 * `Network/download-pipeline.js` 之类的文件就说明这里少导出了什么，补在这里，
 * 别在调用点绕过去。
 */

export { Networks } from './client.js'
export { baseHeaders } from './user-agent.js'
/** 归一化和错误搬运给单测用（`tests/unit/download-options.test.ts`）。 */
export { normalizeDownloadOptions } from './download-options.js'
export { toAxiosError } from './errors.js'
