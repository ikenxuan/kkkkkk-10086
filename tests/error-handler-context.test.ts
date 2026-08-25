import { afterEach, describe, expect, it } from 'vitest'

import {
  createLogContext,
  parseLogsToStructured
} from '../src/module/utils/ErrorHandler/log-context.js'
import {
  getAdapterInfo,
  getAdapterLogoPath
} from '../src/module/utils/ErrorHandler/adapter.js'
import { formatBuildTime } from '../src/module/tooling/build-metadata.js'

// globalThis.logger 在全局声明里是必填的 Logger，所以只能先转成 unknown 再转成
// 带可选 logger 的形状，否则塞部分实现的 mock 会报 TS2740。
const globalWithLogger = globalThis as unknown as { logger?: unknown }

const originalLogger = globalWithLogger.logger

afterEach(() => {
  globalWithLogger.logger = originalLogger
})

describe('error handler context logs', () => {
  it('captures logs from concurrent async contexts without mixing entries', async () => {
    const hostLogger = {
      info: (...args: unknown[]) => args,
      warn: (...args: unknown[]) => args
    }
    globalWithLogger.logger = hostLogger

    const first = createLogContext()
    const second = createLogContext()

    await Promise.all([
      first.run(async () => {
        globalThis.logger?.info('first:start')
        await new Promise(resolve => setTimeout(resolve, 5))
        globalThis.logger?.warn('first:end')
      }),
      second.run(async () => {
        globalThis.logger?.info('second:start')
        await new Promise(resolve => setTimeout(resolve, 1))
        globalThis.logger?.warn('second:end')
      })
    ])

    expect(first.logs().map(log => log.message)).toEqual(['first:start', 'first:end'])
    expect(second.logs().map(log => log.message)).toEqual(['second:start', 'second:end'])
  })

  it('converts host log lines into handler error entries', () => {
    expect(parseLogsToStructured([
      '[12:00:00.123][INFO] 请求开始',
      '[12:00:00.124][ERRO] 请求失败',
      '[12:00:00.125][TRAC] 不应显示'
    ])).toEqual([
      { timestamp: '12:00:00.123', level: 'INFO', message: '请求开始', raw: '[12:00:00.123][INFO] 请求开始' },
      { timestamp: '12:00:00.124', level: 'ERRO', message: '请求失败', raw: '[12:00:00.124][ERRO] 请求失败' }
    ])
  })
})

describe('adapter metadata', () => {
  // TRSS-Yunzai 的 ws 适配器在 connect 时把连接对象挂到 `bot.ws`。`ws` 包只在客户端实例上写
  // `url`（lib/websocket.js 的 initAsClient），服务端 accept 出来的连接没有这个属性
  // —— 「通信方式」那格就是靠这一点分方向的，两个 mock 各代表一个方向。
  const acceptedSocket = { readyState: 1, send: () => {} }
  const dialedSocket = { readyState: 1, send: () => {}, url: 'ws://127.0.0.1:8080/Milky' }

  it('reads the implementation name, protocol and transport off a TRSS-Yunzai OneBot v11 event', () => {
    // 字段形状照抄宿主 plugins/adapter/OneBotv11.js：适配器实例上只有 id / name，
    // id 是平台（"QQ"）、name 是协议标准（"OneBotv11"），协议端真名只在
    // get_version_info 的 app_name 里。之前 name 取 adapter.name，于是接 LLOneBot、
    // 接 NapCat、接 Lagrange 全都显示成 "OneBotv11"，protocol 又拿 adapter.id 兜底成了 "QQ"。
    const info = getAdapterInfo({
      adapter_id: 'QQ',
      adapter_name: 'OneBotv11',
      bot: {
        adapter: { id: 'QQ', name: 'OneBotv11' },
        version: { app_name: 'LLOneBot', app_version: '8.1.8', id: 'QQ', name: 'OneBotv11' },
        ws: acceptedSocket
      }
    })

    expect(info?.name).toBe('LLOneBot')
    expect(info?.version).toBe('8.1.8')
    expect(info?.platform).toBe('QQ')
    expect(info?.protocol).toBe('llonebot')
    expect(info?.standard).toBe('onebot11')
    expect(info?.communication).toBe('webSocketServer')
    // name 停在 "OneBotv11" 上时这里只能命中通用的 onebot.png
    expect(info ? getAdapterLogoPath(info) : undefined).toBe('/image/other/handlerError/llonebot.webp')
  })

  it('keeps the adapter-provided fields when the host already resolved them', () => {
    // Karin 的 bot.adapter 自带 platform/standard/protocol/communication，上游卡片直接读它，
    // 抹平逻辑不能把这些现成结论盖掉。
    const info = getAdapterInfo({
      bot: {
        adapter: {
          name: 'NapCat.Onebot',
          version: '4.18.9',
          platform: 'qq',
          standard: 'onebot11',
          protocol: 'napcat',
          communication: 'webSocketServer'
        }
      }
    })

    expect(info).toMatchObject({
      name: 'NapCat.Onebot',
      version: '4.18.9',
      platform: 'qq',
      standard: 'onebot11',
      protocol: 'napcat',
      communication: 'webSocketServer'
    })
  })

  it('tells an outbound WebSocket client apart from a socket our own server accepted', () => {
    // Milky 适配器是 `new WebSocket(url)` 主动外连（宿主 plugins/adapter/Milky.js），
    // 且 bot.version.id 放的是 impl_name —— Milky 只是协议标准，真正的实现在那里面。
    const info = getAdapterInfo({
      adapter_id: 'Milky',
      adapter_name: 'Milky',
      bot: {
        adapter: { id: 'Milky', name: 'Milky' },
        version: { id: 'Lagrange.Milky', name: 'Milky', version: 'Lagrange.Milky v1.0.0' },
        ws: dialedSocket
      }
    })

    expect(info?.communication).toBe('webSocketClient')
    expect(info?.standard).toBe('milky')
    expect(info?.protocol).toBe('lagrange')
  })

  it('leaves the protocol unknown instead of falling back to the platform id', () => {
    // get_version_info 没拿到（协议端不支持或超时）时 bot.version 只剩宿主塞的 id/name，
    // 这时候认不出协议实现就该照实说 unknown，而不是把平台名摆到「协议实现」那格去。
    const info = getAdapterInfo({
      adapter_id: 'QQ',
      bot: { adapter: { id: 'QQ' } }
    })

    expect(info?.platform).toBe('QQ')
    expect(info?.protocol).toBe('unknown')
    expect(info?.communication).toBe('unknown')
  })

  it('normalizes QQBot to the lowercase id runtime-report keys its multiPage guard on', () => {
    // runtime-report.ts 里 renderer.multiPage 判的是 `protocol !== 'qqbot'`，
    // 而宿主 QQBot 适配器自称 id/name 都是 "QQBot"，不归一的话那个判断永远不成立。
    const info = getAdapterInfo({
      adapter_id: 'QQBot',
      adapter_name: 'QQBot',
      bot: { adapter: { id: 'QQBot', name: 'QQBot' } }
    })

    expect(info?.protocol).toBe('qqbot')
    expect(info?.standard).toBe('qqbot')
  })

  it('never lets adapter credentials or endpoints into labels', () => {
    // 这条不变量原先只有仓库根一个临时探针脚本在验，没进测试树。
    // 为什么重要：labels 是 getAdapterInfo 的返回字段，会跟着 adapterInfo 一起进错误卡片，
    // 而这张卡片的用途正是让用户截图去报 bug —— 适配器实例上挂的 token / 端点
    // 一旦被 Object.values 扫进来，就等于把凭证印在图上到处传。
    // 形状照抄宿主 plugins/adapter/Satori.js：适配器实例上确实带着 token 和两个端点。
    const info = getAdapterInfo({
      bot: {
        adapter: {
          id: 'Satori',
          name: 'Satori',
          token: 'sk-live-SUPERSECRET',
          httpEndpoint: 'http://127.0.0.1:5140/satori/v1',
          wsEndpoint: 'ws://127.0.0.1:5140/satori/v1/events',
          platform: 'chronocat'
        },
        version: { id: 'Satori', name: 'Satori', version: '1.0.0' }
      }
    })

    const serialized = JSON.stringify(info?.labels)
    expect(serialized).not.toContain('SUPERSECRET')
    expect(serialized).not.toContain('ws://')
    expect(serialized).not.toContain('http://')
    // 过滤不能把识别用的标识一起丢掉，否则协议判定就瞎了
    expect(info?.protocol).toBe('chronocat')
    expect(info?.standard).toBe('satori')
  })

  it('matches protocol logos using all adapter metadata fields', () => {
    expect(getAdapterLogoPath({ name: 'Milky', version: '1.0', standard: 'unknown' })).toBe(
      '/image/other/handlerError/Milky.png'
    )
    expect(getAdapterLogoPath({ name: 'Lagrange.OneBot', version: '1.0', standard: 'onebot11' })).toBe(
      '/image/other/handlerError/lagrange.webp'
    )
    // 宿主适配器自称 ComWeChat，资源名却是 Karin 的 conwechat 拼写
    expect(getAdapterLogoPath({ name: 'ComWeChat', version: '0.0.8', standard: 'onebot12' })).toBe(
      '/image/other/handlerError/conwechat.webp'
    )
  })
})

describe('build metadata', () => {
  it('formats ISO build timestamps for the error report', () => {
    expect(formatBuildTime('2026-08-19T06:30:00.000Z')).toMatch(/^2026年08月19日 /)
  })
})
