/**
 * 下载重试的退避与降速决策。
 *
 * 从 `attemptDownloadStream` 的 catch 块里提出来是为了能单测：原来这段埋在
 * 「真的下载失败」之后，想钉住「403 等多久、断流降到多少」就得先造出一个
 * 会 403 的服务器。摘成纯函数以后，只要喂一个 AxiosError 形状就够了。
 */

import type { AxiosError } from 'axios'
import type { NormalizedThrottleOptions } from '@/types/platform'
import { isSslError } from './errors.js'

export interface RetryPlanInput {
  /** 这次失败的错误，已经过 `toAxiosError` 归一化 */
  error: AxiosError
  /** 已经重试过的次数，从 0 起 */
  retryCount: number
  throttle: NormalizedThrottleOptions
  /** 这次重试会不会换到另一条候选地址 */
  willSwitchUrl: boolean
  /**
   * 抖动源，只给 429/403 那条分支用。默认 `Math.random`；
   * 单测里传一个定值就能把那条分支钉死。
   */
  random?: () => number
}

export interface RetryPlan {
  /** 重试前要等多久，毫秒。0 表示立刻重试 */
  waitMs: number
  /** 下一次用的限速值。没开限速或不需要降速时就是原值 */
  nextSpeed: number
}

export const computeRetryPlan = (input: RetryPlanInput): RetryPlan => {
  const { error, retryCount, throttle, willSwitchUrl, random = Math.random } = input
  const is403or429 = error.response?.status === 403 || error.response?.status === 429
  const isReset = error.code === 'ECONNRESET' || error.code === 'ECONNABORTED'
  const isTimeout = error.code === 'ETIMEDOUT'
  const sslError = isSslError(error)
  const nextSpeed = isReset && throttle.enabled && throttle.autoReduce
    ? Math.max(throttle.currentSpeed * 0.6, throttle.minSpeed)
    : throttle.currentSpeed
  // 换到新地址时不必退避：慢/坏的是刚才那个节点，新节点没有理由为它的问题等待。
  // 但 429 例外 —— 那是按 IP 算的，换节点也躲不掉，还是要等。
  const waitMs = willSwitchUrl && !is403or429
    ? 0
    : is403or429
      ? 3000 + random() * 2000
      : isReset
        ? 2000 + retryCount * 1000
        : isTimeout
          ? 2000
          : sslError
            ? 1500 + retryCount * 500
            : 1500 * (retryCount + 1)
  return { waitMs, nextSpeed }
}
