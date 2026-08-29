import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ExecFileException } from 'node:child_process'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `utils/FFmpeg.ts` 里 `recordLiveStream` 的行为护栏。
 *
 * 这个函数的失败模式全是「录到一半才炸、日志里看不出原因」的那类，所以三块重点：
 *
 * 1. **参数拼装**：`-loglevel error` / `-nostats` 少一个，ffmpeg 就持续往 stderr
 *    刷进度行，把 `maxBuffer` 顶满 —— Node 直接 kill 进程，表现成「录了几分钟
 *    神秘失败」。`maxBuffer` / `timeout` 必须真的落进 execFile 的 options，
 *    漏传的话前者用 Node 的 1MB 默认值（同上），后者等于永不兜底。
 * 2. **半成功判定**：外层 `timeout` 的 SIGTERM 一定给出 error，而 flv 被打断后
 *    文件仍然可播。按 `error` 判失败会把一个能用的录像丢掉，所以判据必须是
 *    「盘上有没有内容」。
 * 3. **前置校验**：ffmpeg 缺失时不该去 spawn，否则错误里只有 ENOENT，
 *    和「输出目录不存在」在日志上分不开。
 *
 * execFile 换成假的：真去跑 ffmpeg 就依赖跑测机器装没装它，而且会发真实网络请求。
 * 换掉它同时也接管了 `checkFFmpegAvailable` 的 `-version` 探测。
 */

const childProcessMock = vi.hoisted(() => ({
  execFile: vi.fn()
}))

vi.mock('node:child_process', () => ({
  execFile: childProcessMock.execFile
}))

vi.mock('../../src/module/utils/Common.js', () => ({
  default: { removeFile: vi.fn() }
}))

globalThis.logger = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mark: vi.fn(),
  warn: vi.fn()
} as unknown as typeof logger

const {
  recordLiveStream,
  RECORD_LIVE_STREAM_MAX_BUFFER,
  RECORD_LIVE_STREAM_TIMEOUT_GRACE_MS
} = await import('../../src/module/utils/FFmpeg.js')

type ExecFileCallback = (
  error: ExecFileException | null,
  stdout: string,
  stderr: string
) => void

/** 一次被拦下来的 execFile 调用 */
interface RecordedCall {
  file: string
  args: string[]
  options: Record<string, unknown>
}

/** 只记录真正的录制调用，`-version` 探测单独计数 */
let recordCalls: RecordedCall[] = []
let versionCalls = 0

/** 假 ffmpeg 的行为开关 */
interface FakeFFmpegBehaviour {
  /** `-version` 探测是否成功，即 ffmpeg 是否「装了」 */
  available: boolean
  /** 录制进程退出时给出的错误，null 表示 `-t` 到点自然退出 */
  error: ExecFileException | null
  /** 录制期间往输出文件写多少字节，0 表示压根不建文件 */
  writeBytes: number
}

let behaviour: FakeFFmpegBehaviour

let workDirectory = ''

/** 每个用例用独立的输出路径，避免上一条留下的文件影响 stat 判定 */
let outputCounter = 0
const nextOutputPath = (): string => {
  outputCounter += 1
  return join(workDirectory, `live-${outputCounter}.flv`)
}

beforeAll(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'kkkkkk-record-'))
})

afterAll(async () => {
  await rm(workDirectory, { recursive: true, force: true })
})

beforeEach(() => {
  recordCalls = []
  versionCalls = 0
  behaviour = { available: true, error: null, writeBytes: 1024 }

  childProcessMock.execFile.mockImplementation((
    file: string,
    args: string[],
    options: Record<string, unknown>,
    callback: ExecFileCallback
  ) => {
    // `-version` 探测和录制走同一个 execFile，靠参数区分
    if (args.includes('-version')) {
      versionCalls += 1
      const error = behaviour.available
        ? null
        : Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' }) as ExecFileException
      callback(error, behaviour.available ? 'ffmpeg version 7.1' : '', '')
      return
    }

    recordCalls.push({ file, args, options })

    // 输出路径是 argv 的最后一项。真 ffmpeg 会边拉流边写，这里一次写完就够 ——
    // 被测代码只在进程退出后 stat 一次。
    const outputPath = args[args.length - 1] as string
    const write = behaviour.writeBytes > 0
      ? writeFile(outputPath, Buffer.alloc(behaviour.writeBytes))
      : Promise.resolve()

    void write.then(() => callback(behaviour.error, '', ''))
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

/** 取某个 flag 后面紧跟的那个值，flag 不存在时返回 undefined */
const valueAfter = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

describe('recordLiveStream 的参数拼装', () => {
  it('带上 -c copy / -t / -loglevel error / -nostats', async () => {
    const outputPath = nextOutputPath()

    const result = await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath,
      maxDurationMs: 60_000
    })

    expect(result.success).toBe(true)
    expect(recordCalls).toHaveLength(1)

    const { args } = recordCalls[0] as RecordedCall
    // `-c copy` 是两个 argv 条目，拼成 '-c copy' 一项的话 ffmpeg 认不出来
    expect(valueAfter(args, '-c')).toBe('copy')
    expect(valueAfter(args, '-loglevel')).toBe('error')
    expect(args).toContain('-nostats')
    // 毫秒换算成秒交给 ffmpeg 自己收口
    expect(valueAfter(args, '-t')).toBe('60')
    expect(valueAfter(args, '-i')).toBe('https://pull.example.com/live/room.flv')
    expect(args[args.length - 1]).toBe(outputPath)
  })

  it('maxBuffer 和 timeout 真的落进 execFile 的 options', async () => {
    await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath: nextOutputPath(),
      maxDurationMs: 60_000
    })

    const { options } = recordCalls[0] as RecordedCall
    // 漏了 maxBuffer 就是 Node 的 1MB 默认值，长录制必然被 kill
    expect(options.maxBuffer).toBe(RECORD_LIVE_STREAM_MAX_BUFFER)
    // 外层 timeout 必须比 -t 宽，否则每次都是 timeout 先开枪
    expect(options.timeout).toBe(60_000 + RECORD_LIVE_STREAM_TIMEOUT_GRACE_MS)
    expect(options.timeout as number).toBeGreaterThan(60_000)
  })

  it('请求头排在 -i 前面：放后面会被当成输出选项，头发不出去', async () => {
    await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath: nextOutputPath(),
      maxDurationMs: 10_000,
      headers: {
        Referer: 'https://live.bilibili.com/123',
        'User-Agent': 'Mozilla/5.0'
      }
    })

    const { args } = recordCalls[0] as RecordedCall
    const inputIndex = args.indexOf('-i')

    // User-Agent 走专用 flag：ffmpeg 一定会发一个内置 UA，
    // 再往 -headers 里写一行就出现两个 UA 头
    expect(valueAfter(args, '-user_agent')).toBe('Mozilla/5.0')
    expect(args.indexOf('-user_agent')).toBeLessThan(inputIndex)

    // Referer 走 -headers：B站直播不带它就是 403
    expect(valueAfter(args, '-headers')).toBe('Referer: https://live.bilibili.com/123\r\n')
    expect(args.indexOf('-headers')).toBeLessThan(inputIndex)
  })

  it('头名/头值里的 CRLF 被剔除，远端不能借 Referer 插入额外头', async () => {
    await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath: nextOutputPath(),
      maxDurationMs: 10_000,
      headers: { Referer: 'https://live.bilibili.com/1\r\nX-Injected: yes' }
    })

    const { args } = recordCalls[0] as RecordedCall
    expect(valueAfter(args, '-headers')).toBe('Referer: https://live.bilibili.com/1X-Injected: yes\r\n')
  })

  it('没有请求头时不出现 -headers / -user_agent 这两个空壳参数', async () => {
    await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath: nextOutputPath(),
      maxDurationMs: 10_000
    })

    const { args } = recordCalls[0] as RecordedCall
    expect(args).not.toContain('-headers')
    expect(args).not.toContain('-user_agent')
  })

  it('maxDurationMs 小于 1 秒时兜到 1 秒：-t 0 是「什么都不录」', async () => {
    await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath: nextOutputPath(),
      maxDurationMs: 0
    })

    expect(valueAfter((recordCalls[0] as RecordedCall).args, '-t')).toBe('1')
  })
})

describe('recordLiveStream 的成败判定', () => {
  it('-t 到点自然退出：success true，带上字节数', async () => {
    const outputPath = nextOutputPath()
    behaviour.writeBytes = 4096

    const result = await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath,
      maxDurationMs: 5_000
    })

    expect(result).toMatchObject({ success: true, filePath: outputPath, bytes: 4096 })
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('半成功：进程被打断但文件有内容 → success true', async () => {
    // 外层 timeout 触发的 SIGTERM 就是这个形状
    behaviour.error = Object.assign(new Error('Command failed'), {
      killed: true,
      signal: 'SIGTERM',
      code: null
    }) as unknown as ExecFileException
    behaviour.writeBytes = 2048

    const result = await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath: nextOutputPath(),
      maxDurationMs: 5_000
    })

    expect(result.success).toBe(true)
    expect(result.bytes).toBe(2048)
  })

  it('真失败：进程报错且文件压根没建 → success false', async () => {
    behaviour.error = Object.assign(new Error('403 Forbidden'), { code: 1 }) as unknown as ExecFileException
    behaviour.writeBytes = 0

    const result = await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath: nextOutputPath(),
      maxDurationMs: 5_000
    })

    expect(result).toMatchObject({ success: false, bytes: 0 })
  })

  it('真失败：进程报错且文件是 0 字节 → success false', async () => {
    // 「开了文件但一帧都没拉到」和「压根没建文件」是同一个结论
    const outputPath = nextOutputPath()
    behaviour.error = Object.assign(new Error('Connection reset'), { code: 1 }) as unknown as ExecFileException
    behaviour.writeBytes = 0
    await writeFile(outputPath, '')

    const result = await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath,
      maxDurationMs: 5_000
    })

    expect(result).toMatchObject({ success: false, bytes: 0 })
  })
})

describe('recordLiveStream 的前置校验', () => {
  it('ffmpeg 不可用时直接失败，不去 spawn 录制进程', async () => {
    behaviour.available = false

    const result = await recordLiveStream({
      url: 'https://pull.example.com/live/room.flv',
      outputPath: nextOutputPath(),
      maxDurationMs: 5_000
    })

    expect(result).toMatchObject({ success: false, bytes: 0 })
    // 探测发生了，录制没有 —— 否则错误里只有 ENOENT，和「输出目录不存在」分不开
    expect(versionCalls).toBe(1)
    expect(recordCalls).toHaveLength(0)
  })
})
