import type { UploadConfig } from './config.js'

export type Platform = 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'

export type VideoQuality = '540p' | '720p' | '1080p' | '2k' | '4k' | 'adapt'

export interface FileTitle {
  originTitle?: string
  timestampTitle?: string
}

export interface FileInfo extends FileTitle {
  filepath: string
  totalBytes: number
}

export interface DownloadOptions {
  isLiveStream?: boolean
  liveStreamMaxSize?: number
  currentSpeed?: number
}

export interface NormalizedThrottleOptions {
  enabled: boolean
  currentSpeed: number
  minSpeed: number
  autoReduce: boolean
}

export interface NormalizedDownloadOptions {
  isLiveStream: boolean
  liveStreamMaxSize: number
  multiThread: boolean
  concurrency: number
  throttle: NormalizedThrottleOptions
}

export interface VideoDownloadOptions {
  video_url: string
  title: string
  filetype?: string
  headers?: Record<string, string>
  isLiveStream?: boolean
  liveStreamMaxSize?: number
}

export type DownloadUploadConfig = Pick<
  UploadConfig,
  | 'downloadMultiThread'
  | 'downloadConcurrency'
  | 'downloadThrottle'
  | 'downloadMaxSpeed'
  | 'downloadMinSpeed'
  | 'downloadAutoReduce'
>
