import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `utils/ExternalDownloader.ts` 的行为护栏。
 *
 * 三块重点，全都是「坏了以后表现成别的问题」的那类：
 *
 * 1. **工具解析**：`auto` 探不到工具时必须静默回落 `builtin`。回落没做对的表现是
 *    「装了 curl 的机器好用，没装的机器一次解析都成功不了」。这里用
 *    `setToolAvailability` 把探测结果按住，否则用例在有没有 curl 的机器上会给出
 *    相反的结论。
 * 2. **curl 参数**：`--fail` 少一个，4xx 的错误页就会被写进目标文件 ——
 *    「下载成功但文件是一段 HTML」是本仓库最难查的一类故障。请求头必须是
 *    独立的 argv 条目，拼成 shell 串就是命令注入（URL 和头都来自远端响应）。
 * 3. **重试判定**：口径要和 `CdnRegistry.classifyCdnFailure` 对齐 ——
 *    只有确证「这个节点的问题」才换地址。
 */

// spawn 换成假的：真去跑 curl 的话用例就依赖跑测机器装没装它，而且会发真实网络请求。
// execFile 一并换掉 —— isToolAvailable 用它探 `--version`，探测缓存没命中时
// 会真的 spawn 一个进程出去。
const childProcessMock = vi.hoisted(() => ({
  spawn: vi.fn(),
  execFile: vi.fn()
}))

vi.mock('node:child_process', () => ({
  spawn: childProcessMock.spawn,
  execFile: childProcessMock.execFile
}))

// Config / 宿主日志都走这个全局；缺了它会炸成 `ReferenceError: logger is not defined`，
// 把别的问题伪装成本文件的断言失败。
globalThis.logger = {
  warn: vi.fn(),
  error: vi.fn(),
  mark: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
} as never

const {
  downloadWithTool,
  isRetryableExternalFailure,
  isToolAvailable,
  resetToolAvailability,
  resolveDownloadTool,
  setToolAvailability
} = await import('../../src/module/utils/ExternalDownloader.js')
import type { ExternalDownloadOptions, ExternalToolName } from '../../src/module/utils/ExternalDownloader.js'
import {
  DEFAULT_GRACE_MS,
  DEFAULT_SUSTAIN_MS,
  MIN_REMAINING_BYTES,
  SAMPLE_INTERVAL_MS,
  SLOW_DOWNLOAD_ABORT_CODE
} from '../../src/module/utils/DownloadWatchdog.js'

// ---------------------------------------------------------------------------
// 假子进程
//
// spawn 返回的东西只需要满足被测代码真正碰到的那几个面：stderr 是可读流、
// once('close') / once('error') 能被触发、kill() 可观测。
// ---------------------------------------------------------------------------

interface FakeChild extends EventEmitter {
  stderr: Readable
  kill: ReturnType<typeof vi.fn>
}

/** 这一轮 spawn 收到的调用记录，按调用顺序排 */
interface SpawnCall {
  command: string
  args: string[]
  child: FakeChild
}

let spawnCalls: SpawnCall[] = []

const createFakeChild = (): FakeChild => {
  const child = new EventEmitter() as FakeChild
  child.stderr = new Readable({ read () {} })
  child.kill = vi.fn()
  return child
}

/**
 * 让 spawn 返回假子进程，并按 `plan` 决定它怎么收场。
 *
 * @param plan 拿到假子进程后要做的事（写 stderr、emit close / error）。
 *   在下一个宏任务里执行，模拟真实子进程的异步收场。
 */
const stubSpawn = (plan: (child: FakeChild) => void): void => {
  childProcessMock.spawn.mockImplementation((command: string, args: string[]) => {
    const child = createFakeChild()
    spawnCalls.push({ command, args, child })
    setImmediate(() => plan(child))
    return child
  })
}

/** 只关心 argv、不关心收场的场景：立刻成功退出 */
const stubSpawnSuccess = (): void => {
  stubSpawn(child => child.emit('close', 0))
}

const lastSpawn = (): SpawnCall => {
  const call = spawnCalls[spawnCalls.length - 1]
  if (!call) throw new Error('spawn 没被调用')
  return call
}

let workDirectory = ''

beforeAll(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'kkkkkk-external-'))
})

afterAll(async () => {
  await rm(workDirectory, { recursive: true, force: true })
})

beforeEach(() => {
  resetToolAvailability()
  spawnCalls = []
  childProcessMock.spawn.mockReset()
  childProcessMock.execFile.mockReset()
})

afterEach(() => {
  resetToolAvailability()
})

/** 目标文件路径。每个用例一个，免得互相看到彼此的落盘结果。 */
let fileSeq = 0
const targetPath = (): string => join(workDirectory, `out-${++fileSeq}.bin`)

/**
 * 跑一次 `downloadWithTool` 并把它构造的 argv 取回来。
 *
 * 测的是真正的参数构造函数 —— `buildCurlArgs` / `buildWgetArgs` 都没导出，
 * 只能从 spawn 收到的东西反推，这也正好是它们的真实契约面。
 */
const capturedArgs = async (
  tool: ExternalToolName,
  options: Omit<ExternalDownloadOptions, 'filepath'> & { filepath?: string }
): Promise<string[]> => {
  const filepath = options.filepath ?? targetPath()
  // close(0) 之后被测代码要 fs.stat 目标文件，体积为 0 会被判失败，所以先垫一个字节
  stubSpawn(child => {
    void writeFile(filepath, 'x').then(() => child.emit('close', 0))
  })
  await downloadWithTool(tool, { ...options, filepath })
  return lastSpawn().args
}

/** argv 里某个开关的值。开关不存在时返回 undefined。 */
const flagValue = (args: string[], flag: string): string | undefined => {
  const at = args.indexOf(flag)
  return at === -1 ? undefined : args[at + 1]
}

/** argv 里所有 `--header X` 的值 */
const headerValues = (args: string[]): string[] =>
  args.reduce<string[]>((acc, item, index) => {
    if (item === '--header') acc.push(args[index + 1] ?? '')
    return acc
  }, [])

describe('resolveDownloadTool', () => {
  it('auto 优先 curl —— --speed-limit 正是我们要的能力，wget 没有等价物', async () => {
    setToolAvailability('curl', true)
    setToolAvailability('wget', true)

    expect(await resolveDownloadTool('auto')).toBe('curl')
  })

  it('auto：curl 不在时用 wget', async () => {
    setToolAvailability('curl', false)
    setToolAvailability('wget', true)

    expect(await resolveDownloadTool('auto')).toBe('wget')
  })

  it('auto：两个都不在时静默回落 builtin —— 装没装 curl 不该决定解析成不成功', async () => {
    setToolAvailability('curl', false)
    setToolAvailability('wget', false)

    expect(await resolveDownloadTool('auto')).toBe('builtin')
  })

  it.each([
    ['curl', 'curl'],
    ['wget', 'wget']
  ])('显式指定 %s 且它在，就用它', async (configured, expected) => {
    setToolAvailability('curl', true)
    setToolAvailability('wget', true)

    expect(await resolveDownloadTool(configured)).toBe(expected)
  })

  it.each([
    ['curl'],
    ['wget']
  ])('显式指定 %s 但它不在，回落 builtin 而不是抛', async configured => {
    setToolAvailability('curl', false)
    setToolAvailability('wget', false)

    expect(await resolveDownloadTool(configured)).toBe('builtin')
  })

  it('大小写与空白都归一 —— 配置是人手写的 yaml', async () => {
    setToolAvailability('curl', true)

    expect(await resolveDownloadTool('  CURL  ')).toBe('curl')
    expect(await resolveDownloadTool(' Auto ')).toBe('curl')
  })

  it.each([
    ['builtin', 'builtin'],
    ['空串', ''],
    ['未知值', 'aria2c'],
    ['undefined', undefined],
    ['null', null],
    ['数字', 7],
    ['对象', { tool: 'curl' }]
  ])('%s 一律 builtin', async (_label, configured) => {
    setToolAvailability('curl', true)
    setToolAvailability('wget', true)

    expect(await resolveDownloadTool(configured)).toBe('builtin')
  })

  it('回落时不去探测工具 —— 未知配置值不该白花两次 spawn', async () => {
    expect(await resolveDownloadTool('nonsense')).toBe('builtin')

    expect(childProcessMock.execFile).not.toHaveBeenCalled()
  })
})

describe('isToolAvailable', () => {
  it('探测结果缓存在进程内，同一个工具只问一次', async () => {
    // promisify(execFile) 认的是 (file, args, options, callback) 这个形状
    childProcessMock.execFile.mockImplementation((
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      callback(null, 'curl 8.4.0', '')
    })

    expect(await isToolAvailable('curl')).toBe(true)
    expect(await isToolAvailable('curl')).toBe(true)
    expect(childProcessMock.execFile).toHaveBeenCalledTimes(1)
  })

  it('探测失败记成 false，也只问一次 —— 没装的机器不该每次下载都试着 spawn', async () => {
    childProcessMock.execFile.mockImplementation((
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      callback(Object.assign(new Error('spawn wget ENOENT'), { code: 'ENOENT' }), '', '')
    })

    expect(await isToolAvailable('wget')).toBe(false)
    expect(await isToolAvailable('wget')).toBe(false)
    expect(childProcessMock.execFile).toHaveBeenCalledTimes(1)
  })

  it('setToolAvailability 直接顶掉探测，一次 execFile 都不发', async () => {
    setToolAvailability('curl', true)

    expect(await isToolAvailable('curl')).toBe(true)
    expect(childProcessMock.execFile).not.toHaveBeenCalled()
  })

  it('resetToolAvailability 之后重新探测', async () => {
    setToolAvailability('curl', false)
    expect(await resolveDownloadTool('curl')).toBe('builtin')

    resetToolAvailability()
    setToolAvailability('curl', true)

    expect(await resolveDownloadTool('curl')).toBe('curl')
  })

  it('用 --version 探测，不用 which / where', async () => {
    childProcessMock.execFile.mockImplementation((
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      callback(null, '', '')
    })

    await isToolAvailable('curl')

    expect(childProcessMock.execFile.mock.calls[0]?.[0]).toBe('curl')
    expect(childProcessMock.execFile.mock.calls[0]?.[1]).toEqual(['--version'])
  })
})

describe('curl 参数构造', () => {
  it('--fail 必须在 —— 少了它 4xx 的错误页会被写进目标文件', async () => {
    const args = await capturedArgs('curl', { url: 'https://cdn.example.com/v.mp4' })

    expect(args).toContain('--fail')
  })

  it('跟随重定向、静默但报错、不压缩', async () => {
    const args = await capturedArgs('curl', { url: 'https://cdn.example.com/v.mp4' })

    expect(args).toContain('--location')
    expect(args).toContain('--silent')
    expect(args).toContain('--show-error')
    expect(flagValue(args, '--max-redirs')).toBe('5')
    // 和内建下载一致地要求 identity，两条路下出来的字节数才可比
    expect(headerValues(args)).toContain('Accept-Encoding: identity')
  })

  it('落盘路径走 --output，URL 用 -- 隔开放在最后', async () => {
    const filepath = targetPath()
    const url = 'https://cdn.example.com/v.mp4?upsig=abc'
    const args = await capturedArgs('curl', { url, filepath })

    expect(flagValue(args, '--output')).toBe(filepath)
    // `--` 之后才是 URL：以 `-` 开头的地址不会被当成开关
    expect(args.slice(-2)).toEqual(['--', url])
  })

  it('刻意不设 --max-time —— 那是整次传输的上限，大文件在慢网络上会被拦腰砍断', async () => {
    const args = await capturedArgs('curl', { url: 'https://cdn.example.com/v.mp4' })

    expect(args).not.toContain('--max-time')
  })

  it('建连超时按毫秒折成秒，默认 30 秒', async () => {
    expect(flagValue(await capturedArgs('curl', { url: 'https://x.example.com/v' }), '--connect-timeout')).toBe('30')
    expect(flagValue(await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      connectTimeoutMs: 8000
    }), '--connect-timeout')).toBe('8')
  })

  it('不足 1 秒的建连超时垫到 1 —— curl 收到 0 会当成「不限时」', async () => {
    expect(flagValue(await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      connectTimeoutMs: 200
    }), '--connect-timeout')).toBe('1')
  })

  it.each([
    ['没给地板速', undefined],
    ['地板速为 0', 0]
  ])('%s 时不出现 --speed-limit / --speed-time', async (_label, slowFloorBytesPerSecond) => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond
    })

    expect(args).not.toContain('--speed-limit')
    expect(args).not.toContain('--speed-time')
  })

  it('设了地板速才带上低速中断，持续窗口默认 20 秒', async () => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: 256 * 1024
    })

    expect(flagValue(args, '--speed-limit')).toBe(String(256 * 1024))
    expect(flagValue(args, '--speed-time')).toBe('20')
  })

  it('自定义持续窗口按毫秒折成秒，不足 1 秒垫到 1', async () => {
    expect(flagValue(await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: 1024,
      slowSustainMs: 45000
    }), '--speed-time')).toBe('45')

    expect(flagValue(await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: 1024,
      slowSustainMs: 10
    }), '--speed-time')).toBe('1')
  })

  it.each([
    ['没限速', undefined],
    ['限速为 0', 0]
  ])('%s 时不出现 --limit-rate', async (_label, maxSpeedBytesPerSecond) => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      maxSpeedBytesPerSecond
    })

    expect(args).not.toContain('--limit-rate')
  })

  it('限速开着才带 --limit-rate，值是字节/秒', async () => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      maxSpeedBytesPerSecond: 2 * 1024 * 1024
    })

    expect(flagValue(args, '--limit-rate')).toBe(String(2 * 1024 * 1024))
  })

  it('请求头是独立的 argv 条目，绝不拼成一条串', async () => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      headers: { Referer: 'https://www.bilibili.com', 'User-Agent': 'kkk/1.0' }
    })

    expect(headerValues(args)).toEqual([
      'Accept-Encoding: identity',
      'Referer: https://www.bilibili.com',
      'User-Agent: kkk/1.0'
    ])
    // 每个头都由「--header」+「一整条」两项组成，没有任何一项同时含两个头
    for (const value of headerValues(args)) expect(value).not.toContain('\n')
  })

  it('头里的 shell 元字符原样进 argv —— execFile/spawn 不过 shell，注入不成立', async () => {
    const payload = 'a"; rm -rf /; echo "b'
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      headers: { Cookie: payload }
    })

    expect(headerValues(args)).toContain(`Cookie: ${payload}`)
  })

  it('空串头被跳过 —— 空 Cookie 是本仓库表达「这次别带 ck」的方式', async () => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      headers: { Cookie: '', Referer: 'https://www.bilibili.com' }
    })

    // 传 `Cookie: ` 给 curl 会真的发一个空头出去，那就不是「别带」了
    expect(headerValues(args).some(value => value.startsWith('Cookie'))).toBe(false)
    expect(headerValues(args)).toContain('Referer: https://www.bilibili.com')
  })

  it.each([
    ['undefined', undefined],
    ['null', null]
  ])('%s 值的头同样跳过', async (_label, value) => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      headers: { Cookie: value } as never
    })

    expect(headerValues(args).some(header => header.startsWith('Cookie'))).toBe(false)
  })

  it('数组值按 HTTP 语义拆成多行同名头，空项剔掉', async () => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      headers: { 'Set-Cookie': ['a=1', '', 'b=2'] }
    })

    expect(headerValues(args)).toEqual([
      'Accept-Encoding: identity',
      'Set-Cookie: a=1',
      'Set-Cookie: b=2'
    ])
  })

  it('代理拼成 protocol://host:port', async () => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      proxy: { host: '127.0.0.1', port: 7890, protocol: 'http' }
    })

    expect(flagValue(args, '--proxy')).toBe('http://127.0.0.1:7890')
  })

  it('代理凭据做百分号编码 —— 密码里的 @ 会把地址拆歪', async () => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      proxy: { host: 'proxy.local', port: 8080, auth: { username: 'u@b', password: 'p@ss/word' } }
    })

    expect(flagValue(args, '--proxy')).toBe('http://u%40b:p%40ss%2Fword@proxy.local:8080')
  })

  it.each([
    ['false', false as const],
    ['undefined', undefined],
    ['没有 host', { host: '', port: 1080 } as never]
  ])('代理为 %s 时不出现 --proxy', async (_label, proxy) => {
    const args = await capturedArgs('curl', { url: 'https://x.example.com/v', proxy })

    expect(args).not.toContain('--proxy')
  })

  it('目标文件不存在时不加 --continue-at，哪怕开了 resume', async () => {
    const args = await capturedArgs('curl', {
      url: 'https://x.example.com/v',
      filepath: join(workDirectory, 'never-written.bin'),
      resume: true
    })

    // 对一个不存在的文件说「接着下」，curl 会从 0 开始但仍要求服务端支持 Range
    expect(args).not.toContain('--continue-at')
  })

  it('目标文件已存在且 resume 为真时带上 --continue-at -', async () => {
    const filepath = join(workDirectory, 'partial.bin')
    await writeFile(filepath, 'partial')

    stubSpawn(child => child.emit('close', 0))
    await downloadWithTool('curl', { url: 'https://x.example.com/v', filepath, resume: true })

    expect(flagValue(lastSpawn().args, '--continue-at')).toBe('-')
  })

  it('resume 为假时即使文件存在也不续传', async () => {
    const filepath = join(workDirectory, 'existing.bin')
    await writeFile(filepath, 'existing')

    stubSpawn(child => child.emit('close', 0))
    await downloadWithTool('curl', { url: 'https://x.example.com/v', filepath })

    expect(lastSpawn().args).not.toContain('--continue-at')
  })

  it('spawn 拿到的是工具名 + 参数数组，且 windowsHide', async () => {
    await capturedArgs('curl', { url: 'https://x.example.com/v' })
    const call = childProcessMock.spawn.mock.calls[0]

    expect(call?.[0]).toBe('curl')
    expect(Array.isArray(call?.[1])).toBe(true)
    expect(call?.[2]).toMatchObject({ windowsHide: true })
    // 绝不能出现 shell: true —— URL 和请求头都来自远端响应
    expect(call?.[2]).not.toHaveProperty('shell', true)
  })
})

describe('wget 参数构造', () => {
  it('基本开关：静默、限重定向、只试一次、identity', async () => {
    const filepath = targetPath()
    const args = await capturedArgs('wget', { url: 'https://x.example.com/v', filepath })

    expect(args).toContain('--quiet')
    expect(flagValue(args, '--max-redirect')).toBe('5')
    expect(flagValue(args, '--tries')).toBe('1')
    expect(flagValue(args, '--output-document')).toBe(filepath)
    expect(headerValues(args)).toContain('Accept-Encoding: identity')
    expect(args.slice(-2)).toEqual(['--', 'https://x.example.com/v'])
  })

  it('只用 --read-timeout 兜断流，不拿它当低速看守', async () => {
    const args = await capturedArgs('wget', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: 256 * 1024
    })

    expect(flagValue(args, '--read-timeout')).toBe('60')
    // wget 没有按速率中断的能力，地板速在这条路上必须被忽略而不是错译成 timeout
    expect(args).not.toContain('--speed-limit')
    expect(args).not.toContain('--speed-time')
  })

  it('限速用 --limit-rate=N 的等号写法', async () => {
    const args = await capturedArgs('wget', {
      url: 'https://x.example.com/v',
      maxSpeedBytesPerSecond: 1024 * 1024
    })

    expect(args).toContain(`--limit-rate=${1024 * 1024}`)
  })

  it('代理走三条 --execute', async () => {
    const args = await capturedArgs('wget', {
      url: 'https://x.example.com/v',
      proxy: { host: '127.0.0.1', port: 7890, protocol: 'http' }
    })

    expect(args).toContain('use_proxy=yes')
    expect(args).toContain('http_proxy=http://127.0.0.1:7890')
    expect(args).toContain('https_proxy=http://127.0.0.1:7890')
  })

  it('续传开关是 --continue，不带值', async () => {
    const filepath = join(workDirectory, 'wget-partial.bin')
    await writeFile(filepath, 'partial')

    stubSpawn(child => child.emit('close', 0))
    await downloadWithTool('wget', { url: 'https://x.example.com/v', filepath, resume: true })

    expect(lastSpawn().args).toContain('--continue')
  })
})

describe('downloadWithTool 的收场', () => {
  it('成功时返回 fs.stat 量到的体积，而不是工具自报的', async () => {
    const filepath = targetPath()
    stubSpawn(child => {
      void writeFile(filepath, 'abcdefghij').then(() => child.emit('close', 0))
    })

    expect(await downloadWithTool('curl', { url: 'https://x.example.com/v', filepath })).toEqual({
      filepath,
      totalBytes: 10
    })
  })

  it('退出码非 0 时抛出带退出码与状态码的错误', async () => {
    const filepath = targetPath()
    stubSpawn(child => {
      child.stderr.push('curl: (22) The requested URL returned error: 403\n')
      child.stderr.push(null)
      child.emit('close', 22)
    })

    await expect(downloadWithTool('curl', { url: 'https://x.example.com/v', filepath }))
      .rejects.toMatchObject({
        code: 'KKK_EXTERNAL_DOWNLOAD_FAILED',
        exitCode: 22,
        status: 403,
        slow: false
      })
  })

  it('curl 退出码 28 记成低速/超时中断', async () => {
    const filepath = targetPath()
    stubSpawn(child => {
      child.stderr.push('curl: (28) Operation too slow\n')
      child.stderr.push(null)
      child.emit('close', 28)
    })

    const error = await downloadWithTool('curl', { url: 'https://x.example.com/v', filepath }).catch(e => e)

    expect(error).toMatchObject({ code: 'KKK_EXTERNAL_DOWNLOAD_SLOW', slow: true })
    expect(isRetryableExternalFailure(error)).toBe(true)
  })

  it('wget 的 ERROR 403 文案同样解得出状态码', async () => {
    const filepath = targetPath()
    stubSpawn(child => {
      child.stderr.push('ERROR 403: Forbidden.\n')
      child.stderr.push(null)
      child.emit('close', 8)
    })

    await expect(downloadWithTool('wget', { url: 'https://x.example.com/v', filepath }))
      .rejects.toMatchObject({ exitCode: 8, status: 403, slow: false })
  })

  it('wget 退出码 4（网络失败）记成低速那一档', async () => {
    const filepath = targetPath()
    stubSpawn(child => child.emit('close', 4))

    await expect(downloadWithTool('wget', { url: 'https://x.example.com/v', filepath }))
      .rejects.toMatchObject({ code: 'KKK_EXTERNAL_DOWNLOAD_SLOW', slow: true })
  })

  it('退出码 0 但文件为空也算失败 —— 空文件上传出去比报错更难查', async () => {
    const filepath = targetPath()
    stubSpawn(child => {
      void writeFile(filepath, '').then(() => child.emit('close', 0))
    })

    await expect(downloadWithTool('curl', { url: 'https://x.example.com/v', filepath }))
      .rejects.toMatchObject({ code: 'KKK_EXTERNAL_DOWNLOAD_FAILED' })
  })

  it('spawn 本身失败时打掉探测缓存，后续调用会重新回落', async () => {
    setToolAvailability('curl', true)
    const filepath = targetPath()
    childProcessMock.spawn.mockImplementation(() => {
      const child = createFakeChild()
      spawnCalls.push({ command: 'curl', args: [], child })
      setImmediate(() => child.emit('error', Object.assign(new Error('spawn curl ENOENT'), { code: 'ENOENT' })))
      return child
    })

    await expect(downloadWithTool('curl', { url: 'https://x.example.com/v', filepath }))
      .rejects.toMatchObject({ code: 'KKK_EXTERNAL_DOWNLOAD_SPAWN_FAILED', exitCode: null, slow: false })

    // 缓存被打掉了，于是下一次 resolveDownloadTool 会真的去探测
    childProcessMock.execFile.mockImplementation((
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      callback(new Error('ENOENT'), '', '')
    })
    expect(await resolveDownloadTool('curl')).toBe('builtin')
  })

  it('signal 已经取消时立刻 SIGTERM，而不是 SIGKILL', async () => {
    const filepath = targetPath()
    const controller = new AbortController()
    controller.abort()
    stubSpawn(child => child.emit('close', 15))

    await downloadWithTool('curl', { url: 'https://x.example.com/v', filepath, signal: controller.signal })
      .catch(() => {})

    // SIGTERM 让工具有机会 flush 已写的字节，下次重试才能真的断点续传
    expect(lastSpawn().child.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('下载中途取消时也是 SIGTERM', async () => {
    const filepath = targetPath()
    const controller = new AbortController()
    stubSpawn(child => {
      controller.abort()
      setImmediate(() => child.emit('close', 15))
    })

    await downloadWithTool('curl', { url: 'https://x.example.com/v', filepath, signal: controller.signal })
      .catch(() => {})

    expect(lastSpawn().child.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('成功收尾时用真实体积回调一次进度', async () => {
    const filepath = targetPath()
    const onProgress = vi.fn()
    stubSpawn(child => {
      void writeFile(filepath, 'abcde').then(() => child.emit('close', 0))
    })

    await downloadWithTool('curl', { url: 'https://x.example.com/v', filepath, onProgress })

    expect(onProgress).toHaveBeenLastCalledWith(5, 5, false)
  })

  it('stderr 只留尾部，无上限地攒会把内存和日志撑坏', async () => {
    const filepath = targetPath()
    stubSpawn(child => {
      child.stderr.push('x'.repeat(20_000))
      child.stderr.push('\ncurl: (22) The requested URL returned error: 404\n')
      child.stderr.push(null)
      setImmediate(() => child.emit('close', 22))
    })

    const error = await downloadWithTool('curl', { url: 'https://x.example.com/v', filepath }).catch(e => e) as { stderr: string, status?: number }

    expect(error.stderr.length).toBeLessThanOrEqual(300)
    // 截断之后仍然认得出状态码
    expect(error.status).toBe(404)
  })

  it('目标目录不存在时自己建出来', async () => {
    const filepath = join(workDirectory, 'nested', 'deep', 'out.bin')
    stubSpawn(child => {
      void writeFile(filepath, 'ok').then(() => child.emit('close', 0))
    })

    expect((await downloadWithTool('curl', { url: 'https://x.example.com/v', filepath })).totalBytes).toBe(2)
  })
})

describe('isRetryableExternalFailure', () => {
  it('低速/超时中断一律换地址', () => {
    expect(isRetryableExternalFailure({ slow: true })).toBe(true)
    // slow 优先于状态码：500 本来不换，但低速中断说明的是这条链路不行
    expect(isRetryableExternalFailure({ slow: true, status: 500 })).toBe(true)
  })

  it.each([401, 403, 404, 410])('状态码 %d 换地址', status => {
    expect(isRetryableExternalFailure({ status })).toBe(true)
  })

  it.each([
    ['429 限流', 429],
    ['500', 500],
    ['502', 502],
    ['503', 503],
    ['200', 200]
  ])('%s 不换 —— 限流按 IP 算，5xx 是源站问题，所有镜像回同一个源', (_label, status) => {
    expect(isRetryableExternalFailure({ status })).toBe(false)
  })

  it('拿到状态码时退出码不再参与判定', () => {
    // 22 单独在的话该换，但 500 已经说明这不是节点问题
    expect(isRetryableExternalFailure({ status: 500, exitCode: 22 })).toBe(false)
  })

  it.each([
    ['curl 的 HTTP 错误码 22', 22],
    ['wget 的服务器错误码 8', 8]
  ])('没有状态码时 %s 换地址', (_label, exitCode) => {
    expect(isRetryableExternalFailure({ exitCode })).toBe(true)
  })

  it.each([
    ['curl 参数错误 2', 2],
    ['curl 解析不出主机 6', 6],
    ['curl 连不上 7', 7],
    ['wget 网络失败 4', 4],
    ['通用失败 1', 1],
    ['正常退出 0', 0],
    ['null', null]
  ])('%s 不换 —— 退出码本身不足以说明是节点问题', (_label, exitCode) => {
    expect(isRetryableExternalFailure({ exitCode })).toBe(false)
  })

  it('slow 只认布尔真值', () => {
    expect(isRetryableExternalFailure({ slow: 'true' })).toBe(false)
    expect(isRetryableExternalFailure({ slow: 1 })).toBe(false)
    expect(isRetryableExternalFailure({ slow: false })).toBe(false)
  })

  it('状态码是字符串时不当状态码用，回落看退出码', () => {
    expect(isRetryableExternalFailure({ status: '403', exitCode: 22 })).toBe(true)
    expect(isRetryableExternalFailure({ status: '403' })).toBe(false)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['字符串', 'boom'],
    ['数字', 22],
    ['数组', [{ slow: true }]],
    ['空对象', {}],
    ['裸 Error', new Error('boom')]
  ])('%s 不换', (_label, error) => {
    expect(isRetryableExternalFailure(error)).toBe(false)
  })

  it('真实错误形状：Error 上挂着这些字段也认得出来', () => {
    const error = Object.assign(new Error('curl 下载失败'), {
      code: 'KKK_EXTERNAL_DOWNLOAD_FAILED',
      exitCode: 22,
      status: 403,
      slow: false,
      stderr: ''
    })

    expect(isRetryableExternalFailure(error)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// wget 那条路的 Node 侧低速看守
//
// curl 的低速中断在 C 代码里，上面「curl 退出码 28」那条就测完了。wget 没有等价物，
// 判定全在本模块的轮询里，所以这一段要真的把定时器推起来：只验参数的话，
// 「选了 wget 就等于把限速重下整个关掉」这个故障在 argv 上看不出任何异常。
// ---------------------------------------------------------------------------

/**
 * 轮询间隔。模块里的 `PROGRESS_POLL_MS` 没导出，但它的取值有据：注释写明要
 * 「比进度回调的 2 秒节流窗口密一档」，也就是采样窗口的一半。从导出的常量推，
 * 免得将来两边一起调的时候这里还按 1000 算。
 */
const POLL_MS = SAMPLE_INTERVAL_MS / 2

/** 走到「最早可能判定」的那一格要推多少格：宽限期走完，再攒满持续窗口。 */
const TICKS_TO_VERDICT = (DEFAULT_GRACE_MS + DEFAULT_SUSTAIN_MS) / POLL_MS

/** 地板速取生产默认值；慢速用例按每格 1KB 长，差两个数量级，判定不会含糊。 */
const FLOOR_BYTES = 256 * 1024
const SLOW_STEP = 1024

/**
 * 健康用例换一个小地板速，文件按 4 倍地板速长。
 *
 * 用 256KB/s 的话「持续健康」要往盘上垫十几兆字节才演得出来，而判定看的是比值，
 * 换个量级结论不变。
 */
const HEALTHY_FLOOR_BYTES = 1024
const HEALTHY_STEP = HEALTHY_FLOOR_BYTES * 4

/** 总量已知的场景用它：离下完还远，收尾豁免不该插手。 */
const KNOWN_TOTAL = 10 * 1024 * 1024

type Outcome =
  | { status: 'resolved', value: { filepath: string, totalBytes: number } }
  | { status: 'rejected', error: unknown }

interface PolledRun {
  filepath: string
  child: FakeChild
  outcome: Promise<Outcome>
}

/** 让出一个**真的**宏任务。假时钟推不动线程池，真实 IO 得靠它回来。 */
const yieldRealMacrotask = async (): Promise<void> => {
  await new Promise<void>(resolve => setImmediate(resolve))
}

/**
 * 等一格轮询落地最多等这么久（**真实**时钟）。
 *
 * 只用来把「卡住了」炸成一句话，别干等 30 秒的 testTimeout。必须按时间算而不是
 * 按让拍次数算：轮询体里的 `fs.promises.stat` 派到 libuv 线程池上，一次落地要经过
 * 多少个事件循环回合取决于线程池当时排了多少活 —— 整个 tests/ 一起跑的时候那个数字
 * 和单跑本文件时不是一个量级，定额让拍会在满载下从第一格就判「卡住」。
 */
const LANDING_TIMEOUT_MS = 10_000

/**
 * 真实时钟的超时。
 *
 * `setTimeout` 没在 `toFake` 名单里（见下面的 beforeEach），所以它是真的会响 ——
 * 这正是这里要的：假时钟由用例自己按格推，推不动的时候得有个真的东西来叫停。
 */
const realTimeout = (ms: number): { expired: Promise<'timeout'>, cancel: () => void } => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), ms)
  })
  return {
    expired,
    cancel: () => {
      if (timer !== undefined) clearTimeout(timer)
    }
  }
}

/** 数不到落地时（调用方没要进度回调）每格定额让几拍。 */
const BLIND_SPINS_PER_TICK = 3

/**
 * 数不到落地的用例多推几格。
 *
 * 那几格里某一格的 stat 要是慢到下一格才回来，采样就少喂一次、`slowForMs` 跟着少攒
 * 一格，判定卡在临界点上不动手 —— 表现成用例在慢机器上偶发失败。判定会自锁，
 * 多推的格子不可能反过来造出一次误判，所以这个余量只买稳定、不放宽结论。
 */
const BLIND_TICK_MARGIN = 4

/**
 * 起一次下载，按 `sizeAt` 摆出每一格轮询时目标文件该有多大，推 `ticks` 格。
 *
 * 刻意不在这里收场：看守掐进程用的 `kill` 是个 `vi.fn()`，不会真让子进程退出，
 * 而「掐完之后以什么码退」正是几个用例要分别摆的局。
 */
const startPolledDownload = async (
  tool: ExternalToolName,
  options: Omit<ExternalDownloadOptions, 'filepath'>,
  drive: { ticks: number, sizeAt: (tick: number) => number }
): Promise<PolledRun> => {
  const filepath = targetPath()
  await writeFile(filepath, '')
  stubSpawn(() => {})

  // 每格轮询实际落地了没有，靠它数。进度回调和采样在被测代码里是同一个 then，
  // 回调进来就说明这一格的 stat 已经回来、采样也已经喂过了。
  //
  // 只有调用方自己要进度时才挂：`if (options.onProgress || slowGuard)` 里的
  // 后半个分支得有人走过 —— 一律替调用方补一个 onProgress 的话，那半个分支
  // 被删掉也没人发现。
  let landed = 0
  /** 有人在等下一格落地时挂在这里。等的人只在 await 里，所以装上和叫醒不会打架。 */
  let wake: (() => void) | undefined
  const count = (...args: Parameters<NonNullable<ExternalDownloadOptions['onProgress']>>): void => {
    landed += 1
    options.onProgress?.(...args)
    // 放在最后叫醒：resolve 只是排一个微任务，等的人要到本轮 then 体跑完才醒 ——
    // 也就是说醒过来时被测代码那句 slowGuard.sample() 已经喂过了。
    wake?.()
  }
  const counted = options.onProgress === undefined ? undefined : count

  const outcome: Promise<Outcome> = downloadWithTool(tool, {
    ...options,
    filepath,
    onProgress: counted
  }).then(
    value => ({ status: 'resolved', value }),
    (error: unknown) => ({ status: 'rejected', error })
  )

  // spawn 之前被测代码要 await 真实的 mkdir。假时钟对它没有作用，
  // 这里不等的话轮询器还没装上，后面推的每一格都是空推。
  while (spawnCalls.length === 0) await yieldRealMacrotask()

  for (let tick = 1; tick <= drive.ticks; tick++) {
    // 体积用 truncate 摆：轮询体 stat 的是真实路径，得让它看到真的在长
    await truncate(filepath, drive.sizeAt(tick))
    await vi.advanceTimersByTimeAsync(POLL_MS)

    // 推假时钟只排掉了 then 链上的微任务，轮询体里那次 stat 是真实 IO，
    // 得等真的宏任务把它送回来。不等就往下推的话，下一格的 truncate 会盖掉
    // 这一格该被看到的体积，采样跟着串格 —— 表现成判定莫名早一格或晚一格。
    if (counted) {
      // 等这一格落地：由落地本身把我们叫醒（上面那个 wake），而不是数让了多少拍。
      // 让拍次数在满载下不是个可预测的量 —— 线程池排满时第一格就可能要几十个回合，
      // 而这里要表达的只是「等一次真实 IO 回来」，没有次数的含义。
      if (landed < tick) {
        const guard = realTimeout(LANDING_TIMEOUT_MS)
        try {
          // while 而不是 if：一次叫醒只保证「又落地了一格」，落后多格时要接着等
          while (landed < tick) {
            const landedOnce = new Promise<'landed'>(resolve => { wake = () => resolve('landed') })
            // 竞速的另一头是真实时钟。卡住时要立刻炸成一句话，不然就是干等
            // 30 秒的 testTimeout，看上去像用例自己挂了
            if (await Promise.race([landedOnce, guard.expired]) === 'timeout') {
              throw new Error(`第 ${tick} 格轮询等了 ${LANDING_TIMEOUT_MS}ms 还没落地（只落地了 ${landed} 格）`)
            }
          }
        } finally {
          // 摘掉再取消：留着的话下一格的 count 会去 resolve 一个没人等的 promise，
          // 而没取消的真实定时器会把 vitest 的进程按住不退
          wake = undefined
          guard.cancel()
        }
      }
    } else {
      // 没有进度回调可数时只能定额让几拍。这几个用例断言的都是「最后掐掉了」，
      // 让不够的表现是断言失败而不是假绿，所以这里不需要精确到格。
      for (let spin = 0; spin < BLIND_SPINS_PER_TICK; spin++) await yieldRealMacrotask()
    }
  }

  return { filepath, child: lastSpawn().child, outcome }
}

/** 让子进程以给定退出码收场，把落定结果取回来。 */
const settleWith = async (run: PolledRun, exitCode: number | null): Promise<Outcome> => {
  run.child.emit('close', exitCode)
  return await run.outcome
}

describe('wget 的 Node 侧低速看守', () => {
  beforeEach(() => {
    // 只假掉这三样。setImmediate 必须留真的：stubSpawn 靠它交付假子进程,
    // 轮询体里的 fs.promises.stat 也要真的宏任务才回得来 —— 一并假掉的话
    // 表现成「轮询一次都没发生」，看上去像被测代码没装轮询器。
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('持续低速时掐掉 wget，错误带 slow 标记且判定为该换地址', async () => {
    const run = await startPolledDownload('wget', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: FLOOR_BYTES
    }, { ticks: TICKS_TO_VERDICT + BLIND_TICK_MARGIN, sizeAt: tick => tick * SLOW_STEP })

    // SIGTERM 而不是 SIGKILL：留给 wget flush 的机会，下一次才能真的续传
    expect(run.child.kill).toHaveBeenCalledWith('SIGTERM')

    const outcome = await settleWith(run, 15)

    expect(outcome.status).toBe('rejected')
    if (outcome.status !== 'rejected') return
    expect(outcome.error).toMatchObject({ slow: true })
    // 上层换不换地址读的就是这个口径。丢了 slow 标记的表现是「限速的那个 CDN
    // 被反复重试到底」，而不是换一个地址重来
    expect(isRetryableExternalFailure(outcome.error)).toBe(true)
  })

  it('低速错误盖过退出码 —— 被自己掐掉的不能报成泛泛的「wget 失败了」', async () => {
    const run = await startPolledDownload('wget', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: FLOOR_BYTES
    }, { ticks: TICKS_TO_VERDICT + BLIND_TICK_MARGIN, sizeAt: tick => tick * SLOW_STEP })

    // SIGTERM 之后 wget 一定以非零码退出，所以退出码判定要是排在前面，
    // 低速这份错误就永远走不到 —— 这条用例摆的正是那个先后
    const outcome = await settleWith(run, 15)

    expect(outcome.status).toBe('rejected')
    if (outcome.status !== 'rejected') return
    expect(outcome.error).toMatchObject({
      code: SLOW_DOWNLOAD_ABORT_CODE,
      slow: true,
      // 认领的是「我们判它太慢」，不是「它带着 15 退了」
      exitCode: null
    })
    expect((outcome.error as Error).message).toMatch(/下载速度持续低于下限/)
    expect((outcome.error as Error).message).not.toMatch(/下载失败/)
  })

  it('curl 不装 Node 侧看守 —— 同样的低速交给它自己的 --speed-limit', async () => {
    const onProgress = vi.fn()
    const run = await startPolledDownload('curl', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: FLOOR_BYTES,
      onProgress
    }, { ticks: TICKS_TO_VERDICT, sizeAt: tick => tick * SLOW_STEP })

    // 轮询确实在跑（进度回调是同一个轮询体发出来的），所以「没掐」是看守没装，
    // 而不是这一路压根没采样
    expect(onProgress).toHaveBeenCalled()
    expect(run.child.kill).not.toHaveBeenCalled()

    const outcome = await settleWith(run, 0)

    expect(outcome.status).toBe('resolved')
  })

  it.each([
    ['没给地板速', undefined],
    ['地板速为 0', 0]
  ])('wget %s 时不装看守，慢成什么样都不掐', async (_label, slowFloorBytesPerSecond) => {
    const onProgress = vi.fn()
    const run = await startPolledDownload('wget', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond,
      onProgress
    }, { ticks: TICKS_TO_VERDICT, sizeAt: tick => tick * SLOW_STEP })

    expect(onProgress).toHaveBeenCalled()
    // 关掉低速判定是用户的选择，不能被看守自己的默认值顶回来
    expect(run.child.kill).not.toHaveBeenCalled()

    const outcome = await settleWith(run, 0)

    expect(outcome.status).toBe('resolved')
  })

  it('速率健康时一直不动手，哪怕跑过持续窗口两倍那么久', async () => {
    const onProgress = vi.fn()
    const ticks = TICKS_TO_VERDICT * 2
    const run = await startPolledDownload('wget', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: HEALTHY_FLOOR_BYTES,
      onProgress
    }, { ticks, sizeAt: tick => tick * HEALTHY_STEP })

    // 先确认这些格子真的推到了最后一格：轮询要是半路停了，「没掐」就成了
    // 一句空话 —— 那种用例连把看守整个删掉都照样绿
    expect(onProgress).toHaveBeenCalledWith(ticks * HEALTHY_STEP, -1, false)
    // 误判的代价是把一条好连接和已下的字节一起扔掉，然后换个地址重来
    expect(run.child.kill).not.toHaveBeenCalled()

    const outcome = await settleWith(run, 0)

    expect(outcome.status).toBe('resolved')
  })

  it('快下完了不掐 —— 剩余量低于 MIN_REMAINING_BYTES 时重启纯亏', async () => {
    // 剩余量摆进豁免区：重启要重新握手，跨主机时还要丢掉已下的字节，
    // 而剩这么点就算真被限在低速也只剩几十秒
    const startBytes = 8192
    const sizeAt = (tick: number): number => startBytes + tick * SLOW_STEP
    const onProgress = vi.fn()

    const nearlyDone = await startPolledDownload('wget', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: FLOOR_BYTES,
      totalBytes: MIN_REMAINING_BYTES + startBytes,
      onProgress
    }, { ticks: TICKS_TO_VERDICT, sizeAt })

    // 推到了最后一格，所以「没掐」是豁免拦住的，不是格子推少了
    expect(onProgress).toHaveBeenCalledWith(sizeAt(TICKS_TO_VERDICT), MIN_REMAINING_BYTES + startBytes, false)
    expect(nearlyDone.child.kill).not.toHaveBeenCalled()
    expect((await settleWith(nearlyDone, 0)).status).toBe('resolved')

    // 同一条低速曲线、只把总量抬到豁免区之外就该掐。少了这一半，
    // 「豁免生效」和「判定压根没走到」在断言上长得一模一样
    const plentyLeft = await startPolledDownload('wget', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: FLOOR_BYTES,
      totalBytes: MIN_REMAINING_BYTES * 4
    }, { ticks: TICKS_TO_VERDICT + BLIND_TICK_MARGIN, sizeAt })

    expect(plentyLeft.child.kill).toHaveBeenCalledWith('SIGTERM')
    await settleWith(plentyLeft, 15)
  })

  it('看守开着时进度照样报，两边共用同一次 stat', async () => {
    const onProgress = vi.fn()
    const run = await startPolledDownload('wget', {
      url: 'https://x.example.com/v',
      slowFloorBytesPerSecond: FLOOR_BYTES,
      totalBytes: KNOWN_TOTAL,
      onProgress
    }, { ticks: TICKS_TO_VERDICT, sizeAt: tick => tick * SLOW_STEP })

    // 同一个轮询体先回调进度、再喂采样。各自轮询一遍等于把同一个系统调用做两次，
    // 而拆开之后最容易坏的是进度：判定那半边有用例盯着，进度这半边会静默停掉
    expect(onProgress).toHaveBeenCalledWith(SLOW_STEP * 2, KNOWN_TOTAL, false)
    expect(run.child.kill).toHaveBeenCalledWith('SIGTERM')

    await settleWith(run, 15)
  })
})
