import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MessageEvent, MessageId } from '../../src/types/message.js'

const configMock = vi.hoisted(() => ({
  app: { EmojiReply: true }
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

const { getEmojiId, setEmojiReaction } = await import('../../src/module/utils/EmojiReaction.js')

interface EventOptions {
  adapter: unknown
  adapterId?: string
  adapterName?: string
  version?: Record<string, unknown>
  apk?: { display?: string; version?: string }
  messageId?: MessageId
  groupId?: MessageId
  contact?: unknown
  sendApi?: ReturnType<typeof vi.fn>
  setMsgReaction?: ReturnType<typeof vi.fn>
}

const createEvent = (options: EventOptions): MessageEvent => ({
  message_id: options.messageId ?? 12345,
  group_id: options.groupId,
  adapter_id: options.adapterId,
  adapter_name: options.adapterName,
  contact: options.contact,
  bot: {
    adapter: options.adapter,
    apk: options.apk,
    version: options.version,
    sendApi: options.sendApi,
    setMsgReaction: options.setMsgReaction
  }
} as unknown as MessageEvent)

beforeEach(() => {
  configMock.app.EmojiReply = true
  globalThis.logger = {
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), mark: vi.fn()
  } as unknown as typeof logger
})

describe('setEmojiReaction protocol routing', () => {
  it('prefers the native bot reaction method and sends no raw API request', async () => {
    const setMsgReaction = vi.fn(async () => true)
    const sendApi = vi.fn(async () => ({ retcode: 0 }))
    const contact = {}
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { app_name: 'NapCat.Onebot' },
      groupId: 10001,
      contact,
      sendApi,
      setMsgReaction
    })

    await expect(setEmojiReaction(event, 389, false)).resolves.toBe(true)

    expect(setMsgReaction).toHaveBeenCalledOnce()
    expect(setMsgReaction).toHaveBeenCalledWith(contact, 12345, 389, false)
    expect(sendApi).not.toHaveBeenCalled()
  })

  it.each([
    ['false', false],
    ['a failed response envelope', { retcode: 1404, status: 'failed' }]
  ])('treats native setMsgReaction resolving %s as failure without a raw retry', async (_label, response) => {
    const setMsgReaction = vi.fn(async () => response)
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { app_name: 'NapCat.Onebot' },
      groupId: 10001,
      contact: {},
      sendApi,
      setMsgReaction
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(false)
    expect(setMsgReaction).toHaveBeenCalledOnce()
    expect(sendApi).not.toHaveBeenCalled()
  })

  it.each([
    ['unsupported', new Error('setMsgReaction is unsupported')],
    ['not implemented', new Error('setMsgReaction is not implemented')],
    ['未实现', new Error('setMsgReaction 未实现')]
  ])('falls back once when native setMsgReaction reports %s', async (_label, error) => {
    const setMsgReaction = vi.fn(async () => await Promise.reject(error))
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { app_name: 'NapCat.Onebot' },
      groupId: 10001,
      sendApi,
      setMsgReaction,
      contact: {}
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(true)
    expect(setMsgReaction).toHaveBeenCalledOnce()
    expect(sendApi).toHaveBeenCalledOnce()
    expect(sendApi).toHaveBeenCalledWith('set_msg_emoji_like', {
      message_id: 12345,
      emoji_id: 389,
      set: true
    })
  })

  it('does not fall back after a native network error', async () => {
    const setMsgReaction = vi.fn(async () => await Promise.reject(new Error('network timeout')))
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { app_name: 'NapCat.Onebot' },
      groupId: 10001,
      sendApi,
      setMsgReaction,
      contact: {}
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(false)
    expect(setMsgReaction).toHaveBeenCalledOnce()
    expect(sendApi).not.toHaveBeenCalled()
  })

  it('routes the Milky adapter to send_group_message_reaction', async () => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'Milky', name: 'Milky' },
      messageId: '88',
      groupId: '10001',
      sendApi
    })

    await expect(setEmojiReaction(event, 389, false)).resolves.toBe(true)

    expect(sendApi).toHaveBeenCalledOnce()
    expect(sendApi).toHaveBeenCalledWith('send_group_message_reaction', {
      group_id: 10001,
      message_seq: 88,
      reaction: '389',
      reaction_type: 'face',
      is_add: false
    })
  })

  it.each([
    ['adapter_id', { adapterId: 'Milky' }],
    ['adapter_name', { adapterName: 'Milky' }]
  ])('uses Yunzai flat event.%s to route Milky', async (_field, flatAdapter) => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: {},
      ...flatAdapter,
      messageId: 88,
      groupId: 10001,
      sendApi
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(true)
    expect(sendApi).toHaveBeenCalledWith('send_group_message_reaction', {
      group_id: 10001,
      message_seq: 88,
      reaction: '389',
      reaction_type: 'face',
      is_add: true
    })
  })

  it.each([
    ['NapCat.Onebot', 'NapCat'],
    ['LLOneBot', 'LLOneBot']
  ])('routes %s OneBot v11 to set_msg_emoji_like', async (appName, appFullName) => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { app_name: appName, app_full_name: appFullName },
      groupId: 10001,
      sendApi
    })

    await expect(setEmojiReaction(event, 128064)).resolves.toBe(true)

    expect(sendApi).toHaveBeenCalledOnce()
    expect(sendApi).toHaveBeenCalledWith('set_msg_emoji_like', {
      message_id: 12345,
      emoji_id: 128064,
      set: true
    })
  })

  it('routes Lagrange OneBot to set_group_reaction with is_add', async () => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { version: 'Lagrange.OneBot v1.0.0' },
      groupId: '10001',
      sendApi
    })

    await expect(setEmojiReaction(event, 366, false)).resolves.toBe(true)

    expect(sendApi).toHaveBeenCalledOnce()
    expect(sendApi).toHaveBeenCalledWith('set_group_reaction', {
      group_id: 10001,
      message_id: 12345,
      code: '366',
      is_add: false
    })
  })

  it('routes SnowLuma OneBot to set_group_reaction with is_set', async () => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { app_full_name: 'SnowLuma v1.0.0' },
      groupId: 10001,
      sendApi
    })

    await expect(setEmojiReaction(event, '389', true)).resolves.toBe(true)

    expect(sendApi).toHaveBeenCalledOnce()
    expect(sendApi).toHaveBeenCalledWith('set_group_reaction', {
      group_id: 10001,
      message_id: 12345,
      code: '389',
      is_set: true
    })
  })

  it('uses Yunzai canonical apk display labels when version details are absent', async () => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      apk: { display: 'SnowLuma', version: '1.0.0' },
      groupId: 10001,
      sendApi
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(true)

    expect(sendApi).toHaveBeenCalledOnce()
    expect(sendApi).toHaveBeenCalledWith('set_group_reaction', {
      group_id: 10001,
      message_id: 12345,
      code: '389',
      is_set: true
    })
  })

  it('uses bot.version.app_name when it is the only protocol name', async () => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'unknown' },
      version: { app_name: 'Milky' },
      messageId: 88,
      groupId: 10001,
      sendApi
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(true)

    expect(sendApi).toHaveBeenCalledOnce()
    expect(sendApi).toHaveBeenCalledWith('send_group_message_reaction', {
      group_id: 10001,
      message_seq: 88,
      reaction: '389',
      reaction_type: 'face',
      is_add: true
    })
  })

  it.each([
    ['bot.apk.display', { apk: { display: 'LLOneBot Milky' } }],
    ['bot.version.app_full_name', { version: { app_full_name: 'Lagrange.Milky v1.0.0' } }]
  ])('recognizes the Milky implementation label from %s', async (_field, implementationMetadata) => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'unknown' },
      ...implementationMetadata,
      messageId: 88,
      groupId: 10001,
      sendApi
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(true)
    expect(sendApi).toHaveBeenCalledWith('send_group_message_reaction', {
      group_id: 10001,
      message_seq: 88,
      reaction: '389',
      reaction_type: 'face',
      is_add: true
    })
  })

  it('uses bot.version.app_name for platform fallback when adapter metadata is absent', async () => {
    const event = createEvent({
      adapter: {},
      version: { app_name: 'Discord' }
    })

    expect(getEmojiId(event, 'SUCCESS')).toBe('✅')
  })

  it('does not probe raw API actions for an unknown OneBot implementation', async () => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { app_name: 'go-cqhttp' },
      groupId: 10001,
      sendApi
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(false)
    expect(sendApi).not.toHaveBeenCalled()
  })

  it.each([
    ['success:false', { success: false }],
    ['ok:false', { ok: false }]
  ])('treats a sendApi %s response as failure', async (_label, response) => {
    const sendApi = vi.fn(async () => response)
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { app_name: 'NapCat.Onebot' },
      groupId: 10001,
      sendApi
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(false)
    expect(sendApi).toHaveBeenCalledOnce()
  })

  it('treats a failed response as terminal and does not try another action', async () => {
    const sendApi = vi.fn(async () => ({ retcode: 1404, status: 'failed' }))
    const event = createEvent({
      adapter: { id: 'QQ', name: 'OneBotv11' },
      version: { app_name: 'NapCat.Onebot' },
      groupId: 10001,
      sendApi
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(false)
    expect(sendApi).toHaveBeenCalledOnce()
    expect(sendApi).toHaveBeenCalledWith('set_msg_emoji_like', {
      message_id: 12345,
      emoji_id: 389,
      set: true
    })
  })

  it('does not call a group reaction API without a group id', async () => {
    const sendApi = vi.fn(async () => ({ retcode: 0, status: 'ok' }))
    const event = createEvent({
      adapter: { id: 'Milky', name: 'Milky' },
      sendApi
    })

    await expect(setEmojiReaction(event, 389)).resolves.toBe(false)
    expect(sendApi).not.toHaveBeenCalled()
  })
})
