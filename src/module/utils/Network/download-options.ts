import type {
  DownloadOptions,
  DownloadUploadConfig,
  NormalizedDownloadOptions,
  NormalizedSlowGuardOptions
} from '@/types/platform'
import { clampConcurrency } from './DownloadBudget.js'
import {
  DEFAULT_SLOW_FLOOR_BYTES,
  DEFAULT_SUSTAIN_MS,
  SAMPLE_INTERVAL_MS
} from './DownloadWatchdog.js'
import { MB } from './units.js'

export const normalizeDownloadOptions = (
  options: DownloadOptions,
  uploadConfig: DownloadUploadConfig
): NormalizedDownloadOptions => {
  const isLiveStream = options.isLiveStream === true
  const minSpeed = Math.max(0.1, Number(uploadConfig.downloadMinSpeed || 1)) * MB
  const maxSpeed = Math.max(0.1, Number(uploadConfig.downloadMaxSpeed || 10)) * MB
  return {
    isLiveStream,
    liveStreamMaxSize: options.liveStreamMaxSize ?? 10 * MB,
    multiThread: !isLiveStream && uploadConfig.downloadMultiThread === true,
    concurrency: clampConcurrency(uploadConfig.downloadConcurrency),
    throttle: {
      enabled: Boolean(uploadConfig.downloadThrottle),
      currentSpeed: Math.max(minSpeed, Number(options.currentSpeed || maxSpeed)),
      minSpeed,
      autoReduce: uploadConfig.downloadAutoReduce !== false
    },
    slowGuard: normalizeSlowGuard(uploadConfig)
  }
}

/**
 * 低速看守的参数归一化。
 *
 * 关掉的方式有两条，两条都得认：开关置 false，或者把地板速填 0。后者是给
 * 「想留着开关、只是暂时不判」的人用的，YAML 注释里也是这么写的。
 *
 * 主动限速开着的时候要额外让一步：地板速不能高于用户自己设的限速值，否则我们
 * 会把**自己**限出来的速度当成对端在限速，一路重启到重试次数用完。
 */
const normalizeSlowGuard = (uploadConfig: DownloadUploadConfig): NormalizedSlowGuardOptions => {
  const enabled = uploadConfig.downloadSlowRestart !== false
  const configured = uploadConfig.downloadSlowFloor
  const floorKb = configured === undefined ? DEFAULT_SLOW_FLOOR_BYTES / 1024 : Math.max(0, Number(configured) || 0)
  let floorBytesPerSecond = enabled ? floorKb * 1024 : 0
  if (floorBytesPerSecond > 0 && uploadConfig.downloadThrottle) {
    const cap = Math.max(0.1, Number(uploadConfig.downloadMaxSpeed || 10)) * MB
    // 留一半余量：限速流的实际吞吐总在设定值下面浮动，贴着设定值判会误伤
    floorBytesPerSecond = Math.min(floorBytesPerSecond, cap / 2)
  }
  const sustainSeconds = uploadConfig.downloadSlowSustain
  const sustainMs = sustainSeconds === undefined
    ? DEFAULT_SUSTAIN_MS
    : Math.max(SAMPLE_INTERVAL_MS, Number(sustainSeconds) * 1000 || DEFAULT_SUSTAIN_MS)
  return {
    enabled: enabled && floorBytesPerSecond > 0,
    floorBytesPerSecond,
    sustainMs
  }
}

/**
 * 外部下载器的体积门槛，字节。配置里以 MB 计。
 *
 * 拿不到体积时按「没够到门槛」处理：外部工具的收益全在长时间下载上，
 * 为一个体积未知、可能只有几十 KB 的文件多 spawn 一个进程是净亏。
 */
export const externalMinBytes = (uploadConfig: DownloadUploadConfig): number => {
  const configured = Number(uploadConfig.downloadExternalMinSize)
  return (Number.isFinite(configured) && configured > 0 ? configured : 64) * MB
}
