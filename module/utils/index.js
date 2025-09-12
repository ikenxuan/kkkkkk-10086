// ==================== 全局对象 ====================
/** @type {any} */
const global = globalThis

/** @type {any} */
export const logger = global?.logger

/** @type {any} */
export const segment = global?.segment

/** @type {any} */
export const Bot = global?.Bot

// ==================== 核心功能模块 ====================
export { default as Version } from './Version.js'
export { Render } from './Render.js'
export { default as Config } from './Config.js'
export { default as UploadRecord } from './UploadRecord.js'
export { default as Common } from './Common.js'

// ==================== 网络相关模块 ====================
export { Networks, baseHeaders } from './Networks.js'

// ==================== 工具函数 ====================
export { mergeFile } from './FFmpeg.js'

// ==================== 基础类 ====================
export * from './Base.js'
