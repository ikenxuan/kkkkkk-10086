/**
 * 锅巴（Guoba-Plugin）面板类型。
 *
 * 面板协议由宿主定义，基础类型直接沿用 `@types/trss-yunzai` 的声明，
 * 这里只做别名和少量补充，避免业务代码依赖具体的声明文件路径。
 */
import type { guoba } from 'trss-yunzai'

/**
 * 面板数据在类型上只能描述到「键 → 未知值」这一层。
 *
 * 宿主的 `SupportGuoba<T>` 会用 `T` 推导出所有合法的点分字段名，但本插件的
 * schema 里还有 GSubForm 的子表单字段（`switch`、`Keywords` 等），它们并不是
 * 配置对象的顶层路径；而宿主默认的宽泛配置记录类型又会让那套路径推导
 * 无限递归（TS2589）。因此这里固定用 `Record<string, unknown>`。
 */
type GuobaConfigData = Record<string, unknown>

/** `supportGuoba()` 的返回值：插件信息 + 配置面板 */
export type GuobaSupport = guoba.SupportGuoba<GuobaConfigData>

/** 面板左侧列表里的插件信息 */
export type GuobaPluginInfo = guoba.PluginInfo

/** 配置面板：schema 列表 + 读写回调 */
export type GuobaConfigInfo = guoba.ConfigInfo<GuobaConfigData>

/** 单个表单项 */
export type GuobaSchema = guoba.Schema

/** 表单项可用的渲染组件名 */
export type GuobaComponentType = guoba.ComponentType

/**
 * 下拉框 / 单选框的候选项。
 *
 * 锅巴把它放在 `componentProps.options` 里，而声明文件只把 `componentProps`
 * 标成 `object`，所以这里自己描述一遍。
 */
export interface GuobaSchemaOption {
  label: string
  value: string | number
}
