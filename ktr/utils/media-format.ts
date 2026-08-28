/**
 * 媒体度量的展示层格式化，statistics/group 与 statistics/global 共用。
 *
 * 放在 `ktr/utils/` 而不是某个模板的 `components/`：两张统计卡都要这几个函数，
 * 而模板之间互相 import 对方的 components 在本仓没有先例。`theme.ts` 的 `isDark`
 * 就是这么被 36 个模板共用的。
 *
 * 契约侧（`ktr/template/types/media-metrics.ts`）只传毫秒和字节这两个原始单位，
 * 所有排版都在这里做 —— 两张卡各写一遍的话，一边改了进位阈值另一边不会跟着动。
 */

/** 带单位的数值。卡片上大号数字和小号单位是两个 span，所以拆开返回 */
export interface ValueWithUnit {
  /** 数值部分，已按需要保留一位小数 */
  value: string
  /** 单位部分 */
  unit: string
}

/** 只保留必要的那一位小数：`1.0` 读作 `1`，`1.5` 保持 `1.5` */
const trimDecimal = (value: number): string => {
  const fixed = value.toFixed(1)
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

/**
 * 总时长 / 平均时长的大号展示：自动选最合适的单位。
 *
 * 阈值按「读起来自然」定，不按数学整齐：`90分` 比 `1.5小时` 难心算，
 * 所以满 1 小时才进位到小时；`0.8分` 更是没人这么读，满 1 分钟才进位到分。
 * 非有限值、负数一律按 0 处理 —— 数据源侧（media-metrics.ts 的 normalizeDuration）
 * 已经把这些挡掉了，这里只是不让脏数据渲染成 `NaN小时`。
 */
export const formatDuration = (ms: number): ValueWithUnit => {
  if (!Number.isFinite(ms) || ms <= 0) return { value: '0', unit: '秒' }
  if (ms >= HOUR) return { value: trimDecimal(ms / HOUR), unit: '小时' }
  if (ms >= MINUTE) return { value: trimDecimal(ms / MINUTE), unit: '分' }
  return { value: trimDecimal(ms / SECOND), unit: '秒' }
}

/**
 * 单条媒体时长的时钟展示：`1:23:45` / `12:34`。
 *
 * 「最长的那一条视频有多长」用时钟读最直观（跟播放器一致），
 * 而总时长用时钟就不合适了 —— 累计几百小时写成 `312:45:06` 没人看得出量级。
 * 算法与 `ktr/template/_preview/utils/time.ts` 的 formatDuration 一致，
 * 那个只服务预览面板的倒计时，没有跨目录复用的先例，因此不去合并。
 */
export const formatDurationClock = (ms: number): string => {
  const totalSeconds = Number.isFinite(ms) ? Math.max(Math.floor(ms / SECOND), 0) : 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * 字节数的大号展示。
 *
 * 用 1024 进制（`KB` 而非 `KiB`）：解析出去的文件大小在群里的口径一直是这个，
 * 平台侧的体积上限判断（Base.ts 的分片阈值）也是按 1024 算的。
 */
export const formatBytes = (bytes: number): ValueWithUnit => {
  if (!Number.isFinite(bytes) || bytes <= 0) return { value: '0', unit: 'B' }

  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }
  // B 不带小数：`1.5B` 是无意义的精度
  return {
    value: unitIndex === 0 ? String(Math.round(value)) : trimDecimal(value),
    unit: BYTE_UNITS[unitIndex]
  }
}

/** 成功率 0~1 转百分比文本，保留一位小数：`99.5%` */
export const formatPercent = (ratio: number): string => {
  if (!Number.isFinite(ratio)) return '0%'
  return `${trimDecimal(Math.min(Math.max(ratio, 0), 1) * 100)}%`
}

/**
 * 「媒体统计」三张大卡的数值字号，按字符数降级。
 *
 * 为什么需要：卡片宽度是算出来的定值，而字号原来写死 `7rem`。三卡并排时
 * 单张卡内可用宽只有 **261.3px**（1440 页宽 − 页面 `p-18` ×2 − 两个 `gap-16`
 * − 卡片 `p-16` ×2），实测只有 3 字数值装得下：
 *
 * | 数值 | 宽度（7rem） | + 小时(72px) + gap(12px) | 余量 |
 * |---|---|---|---|
 * | `1.9`    | 153.6 | 237.6 | +23.7 |
 * | `61.6`   | 217.4 | 301.4 | **−40.1** |
 * | `347.7`  | 281.2 | 365.2 | **−103.9** |
 * | `1232.6` | 345.1 | 429.1 | **−167.8** |
 *
 * 4 字起必然溢出，然后被根节点的 `overflow-hidden` 从字形中间切断。
 *
 * 阈值按「最宽的单位」定，也就是 `小时`（2 个 CJK = 2em = 72px）。CJK 字形
 * 实测恒为 1em —— 字重 400 / 500 和回退到 Microsoft YaHei 量出来都是 72px，
 * 所以这里不需要考虑合成粗体带来的字宽变化。数字同样是等宽的
 * （每多一位恒 +63.8px，小数点 26px），因此这张表是确定的，不是估的。
 *
 * 只按字符数、不按具体单位分档：单位窄的时候（`分` 36px）本来余量就更大，
 * 按最坏情况定档对它只是更保守，换来的是单变量映射、好测也好读。
 * @param value - 已格式化的数值文本，如 `347.7`
 * @returns Tailwind 任意值字号类名
 */
export const valueSizeClass = (value: string): string => {
  const length = value.length
  if (length <= 3) return 'text-[7rem]'
  if (length === 4) return 'text-[5rem]'
  if (length === 5) return 'text-[4rem]'
  return 'text-[3rem]'
}
