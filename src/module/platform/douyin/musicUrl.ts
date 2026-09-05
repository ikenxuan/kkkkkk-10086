/** 原声 music 对象的读取：真实 id、mp3 候选、候选判活。 */

import { isRecord } from '@/module/utils/record'

/**
 * 裸写 `logger?.debug?.()` 会 ReferenceError（可选链挡不住未声明标识符），
 * 写 `globalThis.logger` 又过不了类型（宿主是 `const logger`），所以显式窄化一次。
 */
const hostLogger = (globalThis as { logger?: { debug?: (message: string) => void } }).logger

interface DouyinMusicLike {
  play_url?: { uri?: string, url_list?: string[] }
  extra?: string
  id?: number | string
  id_str?: string
  mid?: string
}

/**
 * 取原声的真实 id：`mid` / `id_str` 是字符串真值，`id` 是同一个数的 number 形式，
 * 19 位超出 MAX_SAFE_INTEGER 已被 `JSON.parse` 四舍五入。
 * `Number(mid) - Number(id) === 0`，所以只能在字符串层面比。拿错的 id 查歌不报错，只是查不到。
 */
export const getDouyinMusicId = (music: unknown): string => {
  if (!isRecord(music)) return ''
  const m = music as DouyinMusicLike
  const pick = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

  const trusted = pick(m.mid) ?? pick(m.id_str)
  if (trusted) return trusted

  if (typeof m.id === 'number' && Number.isFinite(m.id)) {
    if (!Number.isSafeInteger(m.id)) {
      hostLogger?.debug?.(`[抖音原声] mid / id_str 都没有，只能退回已丢精度的 id: ${m.id}`)
    }
    return String(m.id)
  }
  return pick(m.id) ?? ''
}

/**
 * 原声的全部候选地址，按优先级去重。`play_url.url_list` 通常给两个镜像指向同一个 mp3，
 * 只用 `uri`（= `url_list[0]`）的话那个节点抽风原声就整条没了。
 */
export const getDouyinMusicUrlCandidates = (music: unknown): string[] => {
  if (!isRecord(music)) return []
  const m = music as DouyinMusicLike
  const out: string[] = []
  const push = (value: unknown): void => {
    if (typeof value === 'string' && value.trim() !== '' && !out.includes(value)) out.push(value)
  }

  // uri 通常就是 url_list[0]，先放它是为了让首选项和旧行为一致
  push(m.play_url?.uri)
  if (Array.isArray(m.play_url?.url_list)) m.play_url.url_list.forEach(push)

  // 有些作品的原曲地址只在 extra 里
  try {
    const extra: unknown = JSON.parse(typeof m.extra === 'string' ? m.extra : '{}')
    if (isRecord(extra)) push(extra.original_song_url)
  } catch { /* extra 不是合法 JSON，已收集到的候选照用 */ }
  return out
}

export interface PickReachableMusicUrlOptions {
  timeoutMs?: number
  fetchImpl?: typeof fetch
  probeBytes?: number
}

/**
 * 逐个试候选，返回第一个真能取到音频的那条；全都不可达返回 `undefined`。
 * Range 只拉头部几 KB 判活，不整曲下载；只有一条候选时不判活，没有备选探测纯属白搭。
 */
export const pickReachableMusicUrl = async (
  candidates: string[],
  options: PickReachableMusicUrlOptions = {}
): Promise<string | undefined> => {
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]

  const timeoutMs = options.timeoutMs ?? 8000
  const probeBytes = options.probeBytes ?? 2047
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return candidates[0]

  for (const url of candidates) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetchImpl(url, {
        headers: { Range: `bytes=0-${probeBytes}`, Referer: 'https://www.douyin.com/' },
        signal: controller.signal
      })
      // 206 是 Range 命中，200 是服务端不支持 Range 但内容能取
      if (res.ok || res.status === 206) {
        // 放掉 body，别把探测请求的连接吊在半开状态
        try {
          await res.arrayBuffer()
        } catch { /* 读不完无所谓，状态码已说明可达 */ }
        return url
      }
      hostLogger?.debug?.(`[抖音原声] 候选不可用 HTTP ${res.status}：${url}`)
    } catch {
      hostLogger?.debug?.(`[抖音原声] 候选探测失败：${url}`)
    } finally {
      clearTimeout(timer)
    }
  }
  return undefined
}
