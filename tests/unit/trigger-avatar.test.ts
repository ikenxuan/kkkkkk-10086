import { describe, expect, it } from 'vitest'

import type { MessageEvent } from '../../src/types/message.js'
import { qqUserAvatarUrl, resolveTriggerAvatarUrl } from '../../src/module/utils/avatar.js'

/**
 * 登录二维码中心那张头像（上游 e498c5f）。
 *
 * 这一格是纯装饰：取不到就该返回 undefined，让模板退化成普通二维码。
 * 所以这里钉的重点是「什么情况下**不**给地址」—— 往 `QRCodeWithAvatar` 塞一个
 * 必然 404 的地址，`loadQRCodeAvatar` 要等 5 秒超时才放弃，二维码也就晚 5 秒才发出去。
 *
 * 入参照宿主事件的形状写（`MessageEvent` 是本仓对 `@types/trss-yunzai` 那个
 * `GroupEvent | PrivateEvent` 的镜像），别退回裸对象字面量：
 * 形参是 `Pick<MessageEvent, 'user_id' | 'sender'>`，标上类型这些用例才真的在校验契约。
 */
const event = (fields: Partial<MessageEvent>): MessageEvent => fields as MessageEvent

describe('qqUserAvatarUrl', () => {
  it('纯数字 QQ 号拼出头像地址', () => {
    expect(qqUserAvatarUrl('114514191')).toBe('https://q1.qlogo.cn/g?b=qq&nk=114514191&s=640')
  })

  it('QQBot 的 openid 拿不到头像，返回 undefined 而不是坏地址', () => {
    expect(qqUserAvatarUrl('A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4')).toBeUndefined()
  })

  it('太短的数字不当 QQ 号', () => {
    expect(qqUserAvatarUrl('1234')).toBeUndefined()
  })

  it('空串不当 QQ 号', () => {
    expect(qqUserAvatarUrl('')).toBeUndefined()
  })
})

describe('resolveTriggerAvatarUrl', () => {
  it('读事件上的 user_id', () => {
    expect(resolveTriggerAvatarUrl(event({ user_id: 114514191 })))
      .toBe('https://q1.qlogo.cn/g?b=qq&nk=114514191&s=640')
  })

  it('没有 user_id 时退回 sender.user_id，次序同 ErrorHandler 的 resolveUserId', () => {
    expect(resolveTriggerAvatarUrl(event({ sender: { user_id: 114514191 } })))
      .toBe('https://q1.qlogo.cn/g?b=qq&nk=114514191&s=640')
  })

  it('两处都有时以 user_id 为准', () => {
    expect(resolveTriggerAvatarUrl(event({ user_id: 111111111, sender: { user_id: 222222222 } })))
      .toBe('https://q1.qlogo.cn/g?b=qq&nk=111111111&s=640')
  })

  it('user_id 是字符串数字也认', () => {
    expect(resolveTriggerAvatarUrl(event({ user_id: '114514191' })))
      .toBe('https://q1.qlogo.cn/g?b=qq&nk=114514191&s=640')
  })

  it('openid 事件返回 undefined，二维码退化成普通二维码', () => {
    expect(resolveTriggerAvatarUrl(event({ user_id: 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4' }))).toBeUndefined()
  })

  it('压根没有用户号、或者连事件对象都没有时也不抛', () => {
    // 主动推送由 cron 触发，没有事件对象 —— 同 ErrorHandler/render.ts 的 resolveUserId
    expect(resolveTriggerAvatarUrl(undefined)).toBeUndefined()
    expect(resolveTriggerAvatarUrl(event({}))).toBeUndefined()
    expect(resolveTriggerAvatarUrl(event({ sender: {} }))).toBeUndefined()
  })
})
