import { describe, expect, it } from 'vitest'
import { Networks, normalizeDownloadOptions, toAxiosError } from '../../src/module/utils/Networks.js'
import { clampConcurrency } from '../../src/module/utils/MultipartDownloader.js'

describe('clampConcurrency', () => {
  it.each([
    [1, 2],
    [2, 2],
    [4.9, 4],
    [8, 8],
    [9, 8],
    ['6', 6],
    [Number.NaN, 4],
    [Number.POSITIVE_INFINITY, 4]
  ])('normalizes %j to %d', (value, expected) => {
    expect(clampConcurrency(value)).toBe(expected)
  })
})

describe('Networks request compatibility', () => {
  it('preserves Axios-compatible array-valued headers', () => {
    const network = new Networks({
      url: 'https://example.com',
      headers: { Foo: ['a', 'b'], 'X-Test': 'ok' }
    })

    expect(network.getConfig().headers).toMatchObject({
      Foo: ['a', 'b'],
      'X-Test': 'ok'
    })
  })

  it('preserves Node stream error codes during conversion', () => {
    const error = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' })

    expect(toAxiosError(error)).toMatchObject({
      message: 'connection reset',
      code: 'ECONNRESET'
    })
  })
})

describe('normalizeDownloadOptions', () => {
  it('normalizes single-thread defaults', () => {
    expect(normalizeDownloadOptions({}, {})).toEqual({
      isLiveStream: false,
      liveStreamMaxSize: 10 * 1024 * 1024,
      multiThread: false,
      concurrency: 4,
      throttle: {
        enabled: false,
        currentSpeed: 10 * 1024 * 1024,
        minSpeed: 1024 * 1024,
        autoReduce: true
      }
    })
  })

  it('normalizes multipart and throttle settings within boundaries', () => {
    expect(normalizeDownloadOptions({ currentSpeed: 20 * 1024 * 1024 }, {
      downloadMultiThread: true,
      downloadConcurrency: 99,
      downloadThrottle: true,
      downloadMaxSpeed: 8,
      downloadMinSpeed: 2,
      downloadAutoReduce: false
    })).toEqual({
      isLiveStream: false,
      liveStreamMaxSize: 10 * 1024 * 1024,
      multiThread: true,
      concurrency: 8,
      throttle: {
        enabled: true,
        currentSpeed: 20 * 1024 * 1024,
        minSpeed: 2 * 1024 * 1024,
        autoReduce: false
      }
    })
  })

  it('disables multipart mode for live streams', () => {
    expect(normalizeDownloadOptions({ isLiveStream: true }, {
      downloadMultiThread: true,
      downloadConcurrency: 6
    }).multiThread).toBe(false)
  })
})
