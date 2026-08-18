/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { BangumiBilibiliEpisode, BangumiBilibiliNewEP, BangumiBilibiliStat, BangumiBilibiliUPInfo } from '../../components/types'

/**
 * B站番剧组件数据接口
 */
export interface BangumiBilibiliData {
  /** 主封面图片URL */
  mainCover: string
  /** 演员信息 */
  Actors: string
  /** 番剧评价描述 */
  Evaluate: string
  /** 番剧链接 */
  Link: string
  /** 最新剧集信息 */
  newEP: BangumiBilibiliNewEP
  /** 番剧标题 */
  Title: string
  /** 番剧风格标签 */
  Styles: string[]
  /** 季度ID */
  seasonID: number
  /** 副标题信息 */
  subtitle: string
  /** UP主信息 */
  UPInfo: BangumiBilibiliUPInfo
  /** 版权信息 */
  Copyright: string
  /** 统计数据 */
  Stat: BangumiBilibiliStat
  /** 剧集列表 */
  Episodes: BangumiBilibiliEpisode[]
  /** 剧集总数 */
  length: number
}
