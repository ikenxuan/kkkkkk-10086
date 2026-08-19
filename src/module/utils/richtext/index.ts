/**
 * richtext 共享核心入口（不含 React 渲染器）。
 *
 * 约定：
 * - `src` 只导入这里的节点创建方法和类型，输出可序列化的 `RichTextDocument` JSON。
 * - `ktr` 导入 {@link ../../../../ktr/richtext/index.ts} 那个 barrel，它在本文件之上再补 React 渲染器。
 *
 * 为什么核心放在 `src/` 而不是 `ktr/`：`tsconfig.json` 的 `rootDir` 是 `./src`，
 * `src` 里 import `ktr/` 下的 `.ts` 会 TS6059（emit 会落到 outDir 之外）。上游用
 * pnpm workspace 包 `@kkk/richtext` 绕开这个限制，本仓库是宿主 Yunzai 工作区里的
 * 单包插件，不能自己再开一个 workspace root，所以改成：核心留在 rootDir 内，
 * `@kkk/richtext` 这个说明符按 tsconfig 分别解析——
 * `tsconfig.json` 指向本文件，`tsconfig.template.json` 与 vite 指向 ktr 的 barrel。
 * 两边的 import 写法因此和上游完全一致。
 */
export * from './parse/index.js'
export * from './types.js'
