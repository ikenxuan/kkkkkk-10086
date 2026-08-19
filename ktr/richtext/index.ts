/**
 * richtext 共享包统一入口（模板侧）。
 *
 * 约定：
 * - `core` 只导入节点创建方法和类型，输出可序列化的 `RichTextDocument` JSON。
 * - `template` 只导入这里的 React 渲染器，把 JSON 转成 React 节点。
 *
 * 节点创建方法与类型的唯一事实来源在 `src/module/utils/richtext/`，见那里的说明。
 * 本文件在其之上补 React 渲染器，供 `ktr/` 通过 `@kkk/richtext` 使用。
 */
export * from '../../src/module/utils/richtext'
export * from './react'
