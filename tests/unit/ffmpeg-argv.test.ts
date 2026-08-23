import { writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

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

const { ffmpeg, ffprobe, durationProbeArgs } = await import('../../src/module/utils/FFmpeg.js')

/**
 * 一个假的「ffmpeg」：把收到的 argv 原样打成 JSON。
 *
 * 这样测的是真正的 `ffmpeg()` / `ffprobe()` 包装函数（不是 mock），
 * 只把可执行文件换成能自证收到了什么的东西 —— 参数到底有没有经过 shell，
 * 看它打出来的 argv 就知道。
 */
let printerPath = ''
let workDirectory = ''
const originalFFmpegPath = process.env.FFMPEG_PATH
const originalFFprobePath = process.env.FFPROBE_PATH

beforeAll(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'kkkkkk-argv-'))
  printerPath = join(workDirectory, 'printargv.cjs')
  writeFileSync(printerPath, 'console.log(JSON.stringify(process.argv.slice(2)))')
  // execFile 的第一个参数是可执行文件本身，所以把 node 当「ffmpeg」，
  // 脚本路径作为第一个参数传进去
  process.env.FFMPEG_PATH = process.execPath
  process.env.FFPROBE_PATH = process.execPath
})

afterAll(async () => {
  process.env.FFMPEG_PATH = originalFFmpegPath
  process.env.FFPROBE_PATH = originalFFprobePath
  await rm(workDirectory, { recursive: true, force: true })
})

/** 跑一次假 ffmpeg，把它收到的 argv（去掉脚本路径那一项）解出来 */
const capturedArgs = async (args: string[]): Promise<string[]> => {
  const result = await ffmpeg([printerPath, ...args])
  expect(result.status).toBe(true)
  return JSON.parse(result.stdout.trim()) as string[]
}

describe('ffmpeg / ffprobe 走 execFile，参数不经过 shell', () => {
  it('反引号命令替换不执行，原样作为文件名的一部分传给 ffmpeg', async () => {
    // 这是 49120c2 里实测会真的执行的那个形状：POSIX sh 下双引号内仍做命令替换。
    // 换成 execFile 之后反引号只是文件名里的普通字符。
    const payload = 'clip`echo INJECTED`.mp4'

    expect(await capturedArgs(['-i', payload])).toEqual(['-i', payload])
  })

  it('分号、& 、$() 、管道都只是字面量，不会被拆成第二条命令', async () => {
    const payloads = [
      'a; echo pwned.mp4',
      'a && echo pwned.mp4',
      'a$(echo pwned).mp4',
      'a | echo pwned.mp4',
      'a > overwritten.mp4',
      "a' ; echo pwned; '.mp4",
      'a" ; echo pwned; ".mp4',
      'a%USERPROFILE%.mp4',
      'a^&echo pwned.mp4'
    ]

    for (const payload of payloads) {
      expect(await capturedArgs(['-i', payload])).toEqual(['-i', payload])
    }
  })

  it('带空格的路径不需要引号，且绝不能自己补引号', async () => {
    // 老代码是 `-i "${path}"`，迁移时如果漏了哪处的引号没去掉，
    // ffmpeg 会拿到字面量带引号的文件名而打不开
    const path = join(workDirectory, 'my video file.mp4')

    const args = await capturedArgs(['-i', path])
    expect(args).toEqual(['-i', path])
    expect(args[1]).not.toMatch(/^"/)
  })

  it('滤镜串整串作为一个参数，内部的单引号和逗号保持原样', async () => {
    // 这些引号是 ffmpeg 滤镜解析器自己的，不是 shell 的，必须原样送到
    const filter = "scale='if(gte(iw/ih,16/9),1280,-1)':'if(gte(iw/ih,16/9),-1,720)',scale=ceil(iw/2)*2:ceil(ih/2)*2"

    expect(await capturedArgs(['-vf', filter])).toEqual(['-vf', filter])
  })

  it('滤镜图里的分号不再需要转义，[标签] 也不带引号', async () => {
    const filterComplex = '[0:v]setpts=N/FRAME_RATE/TB[v];[0:a][1:a]amix=inputs=2[aout]'

    expect(await capturedArgs(['-filter_complex', filterComplex, '-map', '[v]'])).toEqual([
      '-filter_complex', filterComplex, '-map', '[v]'
    ])
  })

  it('ffprobe 同样走 execFile，durationProbeArgs 的参数逐个到位', async () => {
    const payload = 'song`echo INJECTED`.mp3'
    const result = await ffprobe([printerPath, ...durationProbeArgs(payload)])

    expect(JSON.parse(result.stdout.trim())).toEqual([
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      payload
    ])
  })

  it('booleanResult 只回执行成败', async () => {
    expect(await ffmpeg([printerPath], { booleanResult: true })).toBe(true)
    expect(await ffmpeg([join(workDirectory, 'does-not-exist.cjs')], { booleanResult: true })).toBe(false)
  })
})
