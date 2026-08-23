import { describe, expect, it, vi } from 'vitest'

// Base.ts 顶层 import 了 @/runtime/host/config，那个模块又在顶层 await 宿主的
// lib/config/config.js，未构建的检出里根本没有这个文件。跟 ffmpeg-options.test.ts 一样把它挡掉。
vi.mock('../../src/runtime/host/config.js', () => ({
  default: { masterQQ: [] }
}))

vi.mock('../../src/module/utils/Render.js', () => ({
  Render: vi.fn()
}))

import { wasMessageSent } from '../../src/module/utils/Base.js'

/**
 * 回归：视频被发了两遍。
 *
 * QQBot 适配器（wind-trace/Yunzai-QQBot-Plugin index.js:807 `async sendMsg`）返回
 * `{ message_id: [], data: [], error: [] }`，message_id 是数组，而且只在 `if (ret.id)`
 * 成立时才 push。旧判据 `Boolean(message_id)` 只认 string | number 标量，于是直链发送
 * 成功也被判成失败，downloadVideo 紧接着又下载又上传，用户收到两条一样的视频。
 */
describe('wasMessageSent', () => {
  it('把 QQBot 的数组 message_id 判成已发送', () => {
    expect(wasMessageSent({ message_id: ['ABC123'], data: [{ id: 'ABC123' }], error: [] })).toBe(true)
  })

  it('QQBot 发成功但返回体没带 id 时也算已发送（就是双发的那个 case）', () => {
    // sendMsg 里是 `if (ret.id) rets.message_id.push(ret.id)`，
    // 所以 ret 没有 id 时 message_id 是空数组，但 data 一定进了一条
    expect(wasMessageSent({ message_id: [], data: [{ ok: true }], error: [] })).toBe(true)
  })

  it('QQBot 四次重试全失败时判成没发出去，保留回退下载上传', () => {
    expect(wasMessageSent({ message_id: [], data: [], error: [new Error('发送消息错误')] })).toBe(false)
  })

  it('QQBot 一条都没发时判成没发出去', () => {
    expect(wasMessageSent({ message_id: [], data: [], error: [] })).toBe(false)
  })

  it('部分成功（有 data 也有 error）算已发送，不能再发一遍', () => {
    expect(wasMessageSent({ message_id: ['ABC'], data: [{ id: 'ABC' }], error: [new Error('第二段失败')] })).toBe(true)
  })

  it('认标量 message_id：OneBot 是数字，ICQQ 是字符串', () => {
    expect(wasMessageSent({ message_id: 123456 })).toBe(true)
    expect(wasMessageSent({ message_id: 'abcdef' })).toBe(true)
  })

  it('标量占位值仍算没发出去，沿用旧判据', () => {
    // 0 / '' 是「字段在但没真发」的占位值，这里必须保持回退下载上传的老行为
    expect(wasMessageSent({ message_id: 0 })).toBe(false)
    expect(wasMessageSent({ message_id: '' })).toBe(false)
  })

  it('压根没有返回值时判成没发出去（e.reply 不存在，可选调用短路）', () => {
    expect(wasMessageSent(undefined)).toBe(false)
    expect(wasMessageSent(null)).toBe(false)
    expect(wasMessageSent(false)).toBe(false)
  })

  it('适配器返回了对象但什么都不报告时算已发送', () => {
    // 宁可少回退一次，也不能把视频再发一遍
    expect(wasMessageSent({})).toBe(true)
  })
})
