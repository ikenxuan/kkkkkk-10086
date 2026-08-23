import { describe, expect, it } from 'vitest'
import {
  buildBilibiliLiveSessionId,
  parseBilibiliLiveStartedAt
} from '../../src/module/platform/bilibili/live-status.js'

describe('Bilibili live session identity', () => {
  it('parses the API local live time as China Standard Time', () => {
    expect(parseBilibiliLiveStartedAt('2026-08-18 12:34:56')).toBe('2026-08-18T04:34:56.000Z')
  })

  it('preserves valid zoned timestamps and trims surrounding whitespace', () => {
    expect(parseBilibiliLiveStartedAt(' 2026-08-18T12:34:56+08:00 ')).toBe('2026-08-18T04:34:56.000Z')
  })

  it.each(['', '   ', '-62170012800', '0000-00-00 00:00:00', 'not-a-date'])(
    'rejects unusable live time %j',
    liveTime => {
      expect(parseBilibiliLiveStartedAt(liveTime)).toBeNull()
    }
  )

  it('builds a stable session id from host, room and the normalized API value', () => {
    expect(buildBilibiliLiveSessionId(123, 456, ' 2026-08-18 12:34:56 '))
      .toBe('bilibili-live:123:456:2026-08-18 12:34:56')
  })

  it('does not build an id without a valid start time', () => {
    expect(buildBilibiliLiveSessionId(123, 456, '0000-00-00 00:00:00')).toBeNull()
  })
})
