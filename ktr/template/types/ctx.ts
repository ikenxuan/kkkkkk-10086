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
    /**
     * 构建这份产物时的源码短提交号（不带 `g` 前缀，例如 `f5f8315`）。
     *
     * 本仓库相对上游 DefaultLayout 的本地增量：页脚在版本号后面补一段
     * `-g{commitId}`，好让用户报 bug 时一眼说清跑的是哪次提交。
     * 取的是构建时烘进 `lib/build-metadata.json` 的源码提交 ——
     * preview / release 分支上的 git 历史是产物历史，问它拿不到源码提交号。
     */
    commitId?: string
    /**
     * 本地领先远程的提交数，大于 0 时页脚在版本号后面插一段 `-{n}`。
     * 对应 `git describe` 里 `v3.1.0-2-g...` 那个 `2`（那边数的是距上一个 tag 的提交数，
     * 这里数的是 `@{upstream}..HEAD`，同样表达「比参照点多出几个提交」）。
     */
    commitsAhead?: number
    /** 安装目录里已跟踪文件有未提交的改动，页脚追加 `-dirty` */
    dirty?: boolean
    /** 发布类型：由安装目录跟踪的远程分支推导（release/master→Stable，preview→Preview，其余→Dev） */
    releaseType: 'Stable' | 'Preview' | 'Dev'
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
