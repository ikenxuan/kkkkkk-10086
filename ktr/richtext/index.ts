/**
 * richtext 共享包统一入口。
 *
 * 约定：
 * - `core` 只导入这里的节点创建方法和类型，输出可序列化的 `RichTextDocument` JSON。
 * - `template` 只导入这里的 React 渲染器，把 JSON 转成 React 节点。
 */
export * from './parse'
export * from './react'
export * from './types'
