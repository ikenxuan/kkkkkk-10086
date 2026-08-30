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

/**
 * 直播流时长上限的默认值，毫秒。
 *
 * 这个数字原来是 `download-pipeline.ts` 里 `isLiveStream ? 120000 : 90000` 的左半边，
 * 也就是「抓直播流」那条探针支路的 abort 时限。搬到这里是为了让它和
 * `liveStreamMaxSize` 一样只有一份：那个字面量之前也在两处各写一遍，改一处漏一处。
 *
 * 导出是给单测拿同一个数字断言用，而不是在测试里抄一遍字面量。
 */
export const DEFAULT_LIVE_STREAM_MAX_DURATION_MS = 120_000

/**
 * 直播流时长上限的归一化。
 *
 * 只认「有限的正数」，其余一律回落默认值。这里不能只写 `?? 默认值`：
 * `0` 和负数都是合法的 `number`，`??` 会原样放过去，而这个值最终会变成
 * `setTimeout(() => controller.abort(), …)` 的延时 —— 传 0 等于「开流即断」，
 * 表现成直播一抓就断，而调用方看到的是自己明明传了个数字。
 * `NaN`（`Number(undefined)` 的常见产物）同理，它和任何数比较都是 false，
 * 会一路走到 setTimeout 里被当成 0。
 */
const normalizeLiveStreamDuration = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_LIVE_STREAM_MAX_DURATION_MS

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
    liveStreamMaxDurationMs: normalizeLiveStreamDuration(options.liveStreamMaxDurationMs),
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
