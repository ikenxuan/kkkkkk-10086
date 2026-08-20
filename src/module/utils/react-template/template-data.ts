import type { ReactTemplateRoute } from './routes.js'

/** 没有登记契约的路由沿用的宽松 payload */
export interface RenderParams extends Record<string, unknown> {
  scale?: number
}

/**
 * 路由 → payload 契约表。
 *
 * 这里刻意是空的。契约本体在 `ktr/template/<route>/components/types.ts`，那些文件进不了
 * 根 program：`tsconfig.json` 的 `rootDir` 是 `./src`，把 `ktr/**` 的 .ts 拉进来直接 TS6059。
 * 所以真实契约由 `contracts/template-data-map.ts` 用模块补充声明（declaration merging）
 * 填进这个接口，而那个文件只被 `tsconfig.render.json` 收录。
 *
 * 两个 program 各拿到想要的东西：
 * - `pnpm build` / `tsc -p tsconfig.json`：表是空的，`Render()` 退回 {@link RenderParams}，
 *   构建不依赖 `ktr/`，编译速度和耦合都跟以前一样
 * - `pnpm typecheck:render`：表被填满，`src/` 里每个 `Render()` 调用点都按真实契约检查
 *
 * 为什么不把契约挪进 `src/`：`ktr/` 是照搬上游的模板树，挪文件会让以后同步上游变成手工活。
 */
export interface TemplateDataMap {}

/**
 * 某个路由的 payload 类型。
 *
 * 表里登记过就用真实契约（多传、少传、类型不对都会红），没登记就退回 {@link RenderParams}。
 * `scale` 是 `Render()` 自己吃掉的渲染参数，不属于模板契约，所以额外并上。
 */
export type TemplateParams<R extends ReactTemplateRoute> =
  R extends keyof TemplateDataMap
    ? TemplateDataMap[R] & { scale?: number }
    : RenderParams
