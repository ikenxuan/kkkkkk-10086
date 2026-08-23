import { describe, expect, it } from 'vitest'

import { formatDouyinPublishTime } from '../ktr/template/douyin/video-work/components/publish-time'

describe('Douyin video poster publish time', () => {
  it('returns a fallback instead of throwing for an invalid create_time', () => {
    expect(() => formatDouyinPublishTime(undefined)).not.toThrow()
    expect(formatDouyinPublishTime(undefined)).toBe('发布时间未知')
    expect(formatDouyinPublishTime('not-a-timestamp')).toBe('发布时间未知')
  })

  it('accepts both Unix seconds and millisecond timestamps', () => {
    expect(formatDouyinPublishTime(Math.floor(Date.now() / 1000))).not.toBe('发布时间未知')
    expect(formatDouyinPublishTime(Date.now())).not.toBe('发布时间未知')
  })
})
