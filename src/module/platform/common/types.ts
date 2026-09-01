import type { LoopVideoContext } from '@/module/utils/FFmpeg'
import type { FileInfo } from '@/types/platform'

export interface BuildLivePhotoResult {
  messages: unknown[]
  tempFiles: FileInfo[]
  generatedLivePhoto: boolean
  context?: LoopVideoContext
}

/** 批量入口里单张图的结果。临时文件只在批结果上汇总一份，见 BuildLivePhotoBatchResult。 */
export interface LivePhotoBatchItemResult {
  /** 该图生成的消息段。空数组表示调用方要回退成普通图片 */
  messages: unknown[]
  generatedLivePhoto: boolean
}

export interface BuildLivePhotoBatchResult {
  /** 与输入 items 一一对应、顺序完全一致 */
  results: LivePhotoBatchItemResult[]
  /**
   * 整批产生的全部临时文件，含失败图已经落盘的那一半。
   * 清理只看这一份 —— 逐图结果里刻意不再重复带一遍，免得调用方两处都收、删两次。
   */
  tempFiles: FileInfo[]
  /** 任意一张生成了实况图即为 true，决定要不要追加提示图 */
  generatedLivePhoto: boolean
  /** 整批结束时的 BGM 上下文 */
  context?: LoopVideoContext
}

/**
 * 直播录制支持的平台。
 *
 * 不是 `Platform` 的全集：快手和小红书这边既没有取流实现、也没有对应配置项，
 * 收成一个更窄的类型是为了让「新增平台」必须同时被类型逼着补全下面的分支。
 */
export type LiveRecordPlatform = 'douyin' | 'bilibili'

/** 一张图自己的实况图参数。缺 staticUrl / liveVideoUrl 表示这张图不做实况图。 */
export interface LivePhotoBatchItem {
  /** 静态图地址 */
  staticUrl?: string
  /** 实况图视频地址 */
  liveVideoUrl?: string
  /** 当前图片序号，只用于临时文件名 */
  index?: number
  /** 视频循环次数。抖音的 clip_type === 4 要 1、其余 3，是按图区分的参数 */
  loopCount?: number
}
