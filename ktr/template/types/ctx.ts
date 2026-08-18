import type { RenderContext } from '@karinjs/template-react'

/**
 * kkk 注入模板的运行时上下文。
 * ktr 的 mergeContext 会把调用方传入的字段原样透传。
 */
export interface PosterContext extends RenderContext {
  /** 版本信息（页脚展示，RemoveWatermark 时不传） */
  version?: {
    /** 框架插件 */
    plugin: string
    /** 插件名称 */
    pluginName: string
    /** 插件版本 */
    pluginVersion: string
    /** 发布类型 */
    releaseType: 'Stable' | 'Preview'
    /** 驱动框架 */
    poweredBy: string
    /** 框架版本 */
    frameworkVersion: string
    /** 是否有可用更新 */
    hasUpdate?: boolean
  }
  /** 水印比特大小（Restore ID） */
  watermarkTextBitSize?: number
  ambientCover?: {
    coverOpacity?: number
    overlayEdgeOpacity?: number
    overlayMiddleOpacity?: number
  }
}

/** kkk 模板组件 props：ktr 标准 { data, ctx } 形状，ctx 带 kkk 扩展字段。 */
export type PosterProps<D> = {
  /** 模板数据（路由级 Data 接口裸写，见 types/platforms/） */
  data: D
  /** ktr 注入的运行时上下文（scale/theme + kkk 扩展字段） */
  ctx: PosterContext
}
