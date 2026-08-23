/**
 * FFmpeg 工具类
 *
 * 本文件基于以下开源项目实现：
 * - FFmpeg: https://github.com/FFmpeg/FFmpeg
 * - FFprobe: https://github.com/FFmpeg/FFmpeg
 *
 * 代码源自了以下项目的实现：
 * - ffmpeg | ffprobe : https://github.com/KarinJS/Karin/blob/main/packages/core/src/utils/system/ffmpeg.ts
 * - exec: https://github.com/KarinJS/Karin/blob/main/packages/core/src/utils/system/exec.ts
 * - stringifyError: https://github.com/KarinJS/Karin/blob/main/packages/core/src/utils/system/error.ts
 *
 */
import {
  execFile as execFileCmd,
  type ExecFileException,
  type ExecFileOptions
} from 'node:child_process'
import Common from './Common.js'

export interface FFmpegExecResult {
  status: boolean
  /**
   * `execFile` 的错误类型，`code` 可能是 string（信号退出时是 `null`、
   * spawn 失败时是 `'ENOENT'` 这种字符串），所以不是 `ExecException`。
   */
  error: ExecFileException | null
  stdout: string
  stderr: string
}

export interface FFmpegExecOptions extends ExecFileOptions {
  log?: boolean
  booleanResult?: boolean
  trim?: boolean
}

/**
 * 一条 ffmpeg / ffprobe 命令的参数数组。
 *
 * 是数组而不是字符串：这两个函数走 `execFile`，参数逐个交给内核，
 * 不经过 shell。所以每个元素都是 ffmpeg 看到的**字面值** ——
 * 路径不要加引号（`'-i', path` 而不是 `'-i', '"path"'`），
 * 滤镜串里的单引号要保留（那是 ffmpeg 滤镜解析器自己的引号，不是 shell 的）。
 */
export type FFmpegArgs = readonly string[]

type FFmpegCallback = (success: boolean, resultPath: string) => boolean | Promise<boolean>

interface BaseFFmpegOptions {
  path: string
  path2?: string
  resultPath: string
  callback?: FFmpegCallback
}

export interface CompressionOptions extends BaseFFmpegOptions {
  targetBitrate?: number
  maxRate?: number
  bufSize?: number
  crf?: number
}

export interface NormalizedCompressionOptions extends BaseFFmpegOptions {
  targetBitrate: number
  maxRate: number
  bufSize: number
  crf: number
}

export interface LoopVideoContext {
  bgmPath: string
  bgmDuration: number
  usedDuration: number
}

export interface LoopVideoOptions {
  inputPath: string
  outputPath: string
  loopCount: number
  staticImagePath: string
  transitionEnabled?: boolean
  bgmPath?: string
  mergeMode?: 'independent' | 'continuous'
  context?: LoopVideoContext
}

export interface NormalizedLoopVideoOptions extends LoopVideoOptions {
  loopCount: number
  transitionEnabled: boolean
  bgmPath: string | undefined
  mergeMode: 'independent' | 'continuous'
  context: LoopVideoContext | undefined
}

type OperationType = '二合一（视频 + 音频）' | '视频*3 + 音频' | '获取指定视频文件时长' | '压缩视频'

export const normalizeCompressionOptions = (
  options: CompressionOptions
): NormalizedCompressionOptions => {
  if (!options.targetBitrate) {
    throw new Error('压缩视频需要指定目标比特率')
  }
  return {
    ...options,
    targetBitrate: options.targetBitrate,
    maxRate: options.maxRate ?? options.targetBitrate * 1.5,
    bufSize: options.bufSize ?? options.targetBitrate * 2,
    crf: options.crf ?? 35
  }
}

export const normalizeLoopVideoOptions = (
  options: LoopVideoOptions
): NormalizedLoopVideoOptions => ({
  ...options,
  loopCount: Math.max(1, Number(options.loopCount) || 1),
  transitionEnabled: options.transitionEnabled ?? true,
  bgmPath: options.bgmPath,
  mergeMode: options.mergeMode ?? 'independent',
  context: options.context
})

/**
 * 「只读一个时长出来」的 ffprobe 参数。
 *
 * 抽成函数是因为这串参数在本文件和 UploadRecord.ts 里一共出现四次，
 * 逐处手抄 argv 数组比抄命令串更容易漏掉一两个元素（漏了不报错，
 * 只是 stdout 变成整份 format 信息，parseFloat 出来是 NaN）。
 *
 * @param filePath 媒体文件路径，原样传给 ffprobe，不需要加引号
 */
export const durationProbeArgs = (filePath: string): string[] => [
  '-v', 'error',
  '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1',
  filePath
]

/**
 * @typedef {Object} FFmpegClientOptions
 * @property {Object} VideoAudioOptions
 * @property {string} VideoAudioOptions.path
 * @property {string} VideoAudioOptions.path2
 * @property {string} VideoAudioOptions.resultPath
 * @property {(success: boolean, resultPath: string) => (boolean|Promise<boolean>)} VideoAudioOptions.callback
 * @property {Object} Video3AudioOptions
 * @property {string} Video3AudioOptions.path
 * @property {string} Video3AudioOptions.path2
 * @property {string} Video3AudioOptions.resultPath
 * @property {(success: boolean, resultPath: string) => (boolean|Promise<boolean>)} Video3AudioOptions.callback
 * @property {Object} getVideoSizeOptions
 * @property {string} getVideoSizeOptions.path
 * @property {Object} compressVideoOptions
 * @property {string} compressVideoOptions.path
 * @property {number} compressVideoOptions.targetBitrate
 * @property {number} [compressVideoOptions.maxRate]
 * @property {number} [compressVideoOptions.bufSize]
 * @property {number} [compressVideoOptions.crf]
 * @property {string} compressVideoOptions.resultPath
 */

/**
 * @typedef {'二合一（视频 + 音频）' | '视频*3 + 音频' | '获取指定视频文件时长' | '压缩视频'} OperationType
 */

/**
 * @typedef {'二合一（视频 + 音频）'} VideoAudioOperation
 * @typedef {'视频*3 + 音频'} Video3AudioOperation
 * @typedef {'获取指定视频文件时长'} GetVideoSizeOperation
 * @typedef {'压缩视频'} CompressVideoOperation
 */

/**
 * @typedef {Object} FFHandlerOptions
 * @property {FFmpegClientOptions['VideoAudioOptions']} VideoAudioOperation
 * @property {FFmpegClientOptions['Video3AudioOptions']} Video3AudioOperation
 * @property {FFmpegClientOptions['getVideoSizeOptions']} 获取指定视频文件时长
 * @property {FFmpegClientOptions['compressVideoOptions']} 压缩视频
 */

/**
 * @template {OperationType} T
 * @typedef {T extends '二合一（视频 + 音频）' ? {status: boolean, error: Error|null, stdout: string, stderr: string} : T extends '视频*3 + 音频' ? {status: boolean, error: Error|null, stdout: string, stderr: string} : T extends '获取指定视频文件时长' ? number : T extends '压缩视频' ? string : never} MergeFileResult
 */

class FFmpeg {
  readonly type: OperationType

  /**
   * @param {OperationType} type 处理类型
   */
  constructor (type: OperationType) {
    this.type = type
  }

  /**
   * @description 使用FFmpeg处理视频文件
   * @template {OperationType} T
   * @param {Object} opt 配置选项
   * @param {string} opt.path 输入视频文件路径
   * @param {string} [opt.path2] 第二个输入文件路径(用于合成)
   * @param {string} opt.resultPath 输出文件路径
   * @param {Function} [opt.callback] 处理完成后的回调函数
   * @param {number} [opt.targetBitrate] 目标比特率(kb/s)
   * @param {number} [opt.maxRate] 最大比特率(kb/s)
   * @param {number} [opt.bufSize] 缓冲大小(kb)
   * @param {number} [opt.crf] CRF值(压缩质量,0-51)
   * @returns {Promise<MergeFileResult<T>|number>} 处理结果
   * @cspell:ignore ffprobe amix aout libx noprint nokey
   */
  async FFmpeg (opt: CompressionOptions): Promise<FFmpegExecResult | number | string> {
    // 检查ffmpeg和ffprobe是否可用
    if (!await checkFFmpegAvailable()) {
      throw new Error('FFmpeg工具未安装或不可用')
    }

    switch (this.type) {
      case '二合一（视频 + 音频）': {
        const result = await ffmpeg(['-y', '-i', opt.path, '-i', String(opt.path2), '-c', 'copy', opt.resultPath])
        if (result && typeof result === 'object' && 'status' in result) {
          result.status ? logger.mark(`视频合成成功！文件地址：${opt.resultPath}`) : logger.error(result)
          if (opt.callback) await opt.callback(result.status, opt.resultPath)
        }
        return /** @type {MergeFileResult<T>} */ (result)
      }
      case '视频*3 + 音频': {
        const result = await ffmpeg([
          '-y',
          '-stream_loop', '2',
          '-i', opt.path,
          '-i', String(opt.path2),
          // 滤镜图整串作为一个参数：`;` 在 shell 里是命令分隔符，在这里只是
          // ffmpeg 滤镜语法的一部分，execFile 不经过 shell 所以无需转义
          '-filter_complex', '[0:v]setpts=N/FRAME_RATE/TB[v];[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=3[aout]',
          '-map', '[v]',
          '-map', '[aout]',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
          opt.resultPath
        ])
        if (result && typeof result === 'object' && 'status' in result) {
          result.status ? logger.mark(`视频合成成功！文件地址：${opt.resultPath}`) : logger.error(result)
          if (opt.callback) await opt.callback(result.status, opt.resultPath)
        }
        return /** @type {MergeFileResult<T>} */ (result)
      }
      case '获取指定视频文件时长': {
        const result = await ffprobe(durationProbeArgs(opt.path))
        if (result && typeof result === 'object' && 'stdout' in result) {
          return parseFloat(parseFloat(String(result.stdout).trim()).toFixed(2))
        }
        return 0
      }
      case '压缩视频': {
        const normalized = normalizeCompressionOptions(opt)
        const result = await ffmpeg([
          '-y',
          '-i', normalized.path,
          '-b:v', `${normalized.targetBitrate}k`,
          '-maxrate', `${normalized.maxRate}k`,
          '-bufsize', `${normalized.bufSize}k`,
          '-crf', String(normalized.crf),
          '-preset', 'medium',
          '-c:v', 'libx264',
          // 滤镜串里的单引号是 ffmpeg 自己的引号（保护 scale 表达式里的逗号），
          // 不是 shell 的，所以原样保留
          '-vf', "scale='if(gte(iw/ih,16/9),1280,-1)':'if(gte(iw/ih,16/9),-1,720)',scale=ceil(iw/2)*2:ceil(ih/2)*2",
          normalized.resultPath
        ])
        if (result && typeof result === 'object' && 'status' in result) {
          if (result.status) {
            logger.mark(`视频已压缩并保存到: ${normalized.resultPath}`)
            Common.removeFile(normalized.path)
          } else {
            logger.error(normalized.path + ' 压缩失败！')
            logger.error(result)
          }
        }
        return normalized.resultPath
      }
      default:
        throw new Error(`不支持的处理类型: ${this.type}`)
    }
  }
}

// 延迟获取 FFmpeg 可执行文件路径，优先级：环境变量 > 默认值
const getFFmpegPath = () => process.env.FFMPEG_PATH || 'ffmpeg'
const getFFprobePath = () => process.env.FFPROBE_PATH || 'ffprobe'

/**
 * @description 检查ffmpeg工具是否可用
 * @returns {Promise<boolean>}
 */
const checkFFmpegAvailable = async (): Promise<boolean> => {
  try {
    // 添加延时防止阻塞
    return await new Promise<boolean>(resolve => {
      setTimeout(async () => {
        resolve(await exec(getFFmpegPath(), ['-version'], { booleanResult: true }))
      }, 1000)
    })
  } catch (error) {
    logger.error('FFmpeg工具检查失败:', error)
    return false
  }
}

/**
 * @description 执行 FFmpeg 命令
 *
 * 参数是数组、不经过 shell（理由见 `exec`）。每个元素都是 ffmpeg 看到的字面值：
 * 路径不要自己加引号，滤镜串整个作为一个元素传。
 *
 * @param args - 参数数组（不含 'ffmpeg' 本身）
 * @param options - 执行选项
 * @param options.log - 是否打印执行日志
 * @param options.booleanResult - 是否只返回执行状态
 * @param options.trim - 是否去除输出内容的首尾空白
 * @param options.cwd - 命令执行的工作目录
 *
 * @example
 * // 转换视频格式
 * const result = await ffmpeg(['-i', 'input.mp4', 'output.avi'])
 *
 * @example
 * // 带空格的路径不需要引号，execFile 会原样传给 ffmpeg
 * const info = await ffmpeg(['-i', 'my video.mp4'], { log: true })
 */
export function ffmpeg (args: FFmpegArgs, options: FFmpegExecOptions & { booleanResult: true }): Promise<boolean>
export function ffmpeg (args: FFmpegArgs, options?: FFmpegExecOptions): Promise<FFmpegExecResult>
export async function ffmpeg (
  args: FFmpegArgs,
  options?: FFmpegExecOptions
): Promise<FFmpegExecResult | boolean> {
  if (options?.booleanResult) return await exec(getFFmpegPath(), args, { ...options, booleanResult: true })
  return await exec(getFFmpegPath(), args, options)
}

/**
 * @description 执行 FFprobe 命令
 *
 * 参数是数组、不经过 shell（理由见 `exec`）。
 *
 * @param args - 参数数组（不含 'ffprobe' 本身）
 * @param options - 执行选项
 * @param options.log - 是否打印执行日志
 * @param options.booleanResult - 是否只返回执行状态
 * @param options.trim - 是否去除输出内容的首尾空白
 * @param options.cwd - 命令执行的工作目录
 *
 * @example
 * const info = await ffprobe(['-i', 'input.mp4'])
 *
 * @example
 * const details = await ffprobe(['-i', 'input.mp4', '-show_format', '-show_streams'], { log: true })
 */
export function ffprobe (args: FFmpegArgs, options: FFmpegExecOptions & { booleanResult: true }): Promise<boolean>
export function ffprobe (args: FFmpegArgs, options?: FFmpegExecOptions): Promise<FFmpegExecResult>
export async function ffprobe (
  args: FFmpegArgs,
  options?: FFmpegExecOptions
): Promise<FFmpegExecResult | boolean> {
  if (options?.booleanResult) return await exec(getFFprobePath(), args, { ...options, booleanResult: true })
  return await exec(getFFprobePath(), args, options)
}

/**
 * @description 使用 FFmpeg 对文件进行处理
 * @template {OperationType} T
 * @param {OperationType} type - 处理方法类型
 * @param {Object} options - 处理选项参数
 * @param {string} options.path 输入视频文件路径
 * @param {string} [options.path2] 第二个输入文件路径(用于合成)
 * @param {string} options.resultPath 输出文件路径
 * @param {Function} [options.callback] 处理完成后的回调函数
 * @param {number} [options.targetBitrate] 目标比特率(kb/s)
 * @param {number} [options.maxRate] 最大比特率(kb/s)
 * @param {number} [options.bufSize] 缓冲大小(kb)
 * @param {number} [options.crf] CRF值(压缩质量,0-51)
 * @returns {Promise<MergeFileResult<T>|number>} 处理结果
 *
 * @example
 * // 合并视频文件
 * const result = await mergeFile('二合一（视频 + 音频）', {
 *   path: 'video.mp4',
 *   path2: 'audio.mp3',
 *   resultPath: 'output.mp4'
 * });
 */
export function mergeFile (
  type: '获取指定视频文件时长',
  options: BaseFFmpegOptions
): Promise<number>
export function mergeFile (
  type: '压缩视频',
  options: CompressionOptions
): Promise<string>
export function mergeFile (
  type: '二合一（视频 + 音频）' | '视频*3 + 音频',
  options: BaseFFmpegOptions
): Promise<FFmpegExecResult>
export async function mergeFile (
  type: OperationType,
  options: CompressionOptions
): Promise<FFmpegExecResult | number | string> {
  return await new FFmpeg(type).FFmpeg(options)
}

/**
 * 获取媒体时长（秒）
 * @param {string} filePath 媒体文件路径
 * @returns {Promise<number>}
 */
export const getMediaDuration = async (filePath: string): Promise<number> => {
  const result = await ffprobe(durationProbeArgs(filePath), { trim: true })
  const stdout = typeof result === 'object' && result?.stdout ? result.stdout : ''
  const duration = Number.parseFloat(stdout)
  return Number.isFinite(duration) ? duration : 0
}

/**
 * 获取媒体帧率（fps）
 * @param {string} filePath 媒体文件路径
 * @returns {Promise<number>}
 */
export const getMediaFrameRate = async (filePath: string): Promise<number> => {
  const result = await ffprobe([
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=avg_frame_rate',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath
  ], { trim: true })
  const rate = typeof result === 'object' && result?.stdout ? result.stdout : ''
  if (!rate) return 30
  if (rate.includes('/')) {
    const [num, den] = rate.split('/', 2).map(value => Number(value))
    if (!num || !den) return 30
    return Math.round((num / den) * 100) / 100
  }
  const parsed = Number(rate)
  return parsed && !Number.isNaN(parsed) ? Math.round(parsed * 100) / 100 : 30
}

const hasAudioStream = async (filePath: string): Promise<boolean> => {
  const result = await ffprobe([
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=index',
    '-of', 'csv=p=0',
    filePath
  ], { trim: true })
  return Boolean(typeof result === 'object' && result?.stdout)
}

/**
 * 生成 Live Photo 风格循环视频，并按配置合并 BGM。
 * @param {Object} options
 * @param {string} options.inputPath 输入视频
 * @param {string} options.outputPath 输出视频
 * @param {number} options.loopCount 循环次数
 * @param {string} options.staticImagePath 静态图路径
 * @param {boolean} [options.transitionEnabled=true] 是否添加静态图过渡
 * @param {string} [options.bgmPath] BGM 路径
 * @param {'independent'|'continuous'} [options.mergeMode='independent'] BGM 合并模式
 * @param {{bgmPath: string, bgmDuration: number, usedDuration: number}} [options.context] 连续模式上下文
 * @returns {Promise<{success: boolean, context?: {bgmPath: string, bgmDuration: number, usedDuration: number}}>}
 */
export const loopVideoWithTransition = async (
  options: LoopVideoOptions
): Promise<{ success: boolean; context?: LoopVideoContext }> => {
  const {
    inputPath,
    outputPath,
    loopCount: safeLoopCount,
    staticImagePath,
    transitionEnabled,
    bgmPath,
    mergeMode,
    context
  } = normalizeLoopVideoOptions(options)

  const duration = await getMediaDuration(inputPath)
  const videoFps = await getMediaFrameRate(inputPath)
  const fadeDuration = transitionEnabled ? Math.min(0.5, Math.max(0.12, duration * 0.18)) : 0
  const staticDuration = transitionEnabled ? 2.5 : 0
  const videoFadeOffset = transitionEnabled ? Math.max(0, duration - fadeDuration) : 0

  let inputArgs: string[] = ['-stream_loop', String(Math.max(0, safeLoopCount - 1)), '-i', inputPath]
  let filterComplex = '[0:v]setpts=PTS-STARTPTS,format=yuv420p,setsar=1[outv]'
  let composedDuration = duration * safeLoopCount

  if (transitionEnabled) {
    inputArgs = [
      '-stream_loop', String(Math.max(0, safeLoopCount)),
      '-i', inputPath,
      '-loop', '1',
      '-i', staticImagePath
    ]
    const splitLabels = Array.from({ length: safeLoopCount }, (_, index) => `[vsplit${index}]`).join('')
    const stillSplitLabels = Array.from({ length: safeLoopCount }, (_, index) => `[still${index}]`).join('')
    const filterParts = [
      `[0:v]setpts=PTS-STARTPTS,settb=1/1000,format=yuv420p,setsar=1,fps=${videoFps}[vbase]`,
      `[vbase]split=${safeLoopCount}${splitLabels}`,
      `[1:v]setpts=PTS-STARTPTS,settb=1/1000,format=yuv420p,setsar=1,fps=${videoFps}[still_base]`,
      `[still_base]split=${safeLoopCount}${stillSplitLabels}`
    ]

    for (let i = 0; i < safeLoopCount; i += 1) {
      const start = Math.max(0, duration * i)
      filterParts.push(`[vsplit${i}]trim=start=${start}:duration=${duration},setpts=PTS-STARTPTS,settb=1/1000[v${i}]`)
      filterParts.push(`[still${i}][v${i}]scale2ref=iw:ih:flags=lanczos[s${i}raw][v${i}r]`)
      filterParts.push(`[s${i}raw]trim=duration=${staticDuration},setpts=PTS-STARTPTS,settb=1/1000[s${i}]`)
    }

    let lastLabel = 'x_s0'
    composedDuration = duration
    filterParts.push(`[v0r][s0]xfade=transition=fade:duration=${fadeDuration}:offset=${videoFadeOffset}[${lastLabel}]`)
    composedDuration = composedDuration + staticDuration - fadeDuration

    for (let i = 1; i < safeLoopCount; i += 1) {
      const toVideoLabel = `x_v${i}`
      const toStillLabel = `x_s${i}`
      const offsetToVideo = Math.max(0, composedDuration - fadeDuration)
      filterParts.push(`[${lastLabel}][v${i}r]xfade=transition=fade:duration=${fadeDuration}:offset=${offsetToVideo}[${toVideoLabel}]`)
      composedDuration = composedDuration + duration - fadeDuration
      const offsetToStill = Math.max(0, composedDuration - fadeDuration)
      filterParts.push(`[${toVideoLabel}][s${i}]xfade=transition=fade:duration=${fadeDuration}:offset=${offsetToStill}[${toStillLabel}]`)
      composedDuration = composedDuration + staticDuration - fadeDuration
      lastLabel = toStillLabel
    }

    filterParts.push(`[${lastLabel}]null[outv]`)
    filterComplex = filterParts.join(';')
  }

  if (bgmPath) {
    const baseContext = context ?? {
      bgmPath,
      bgmDuration: await getMediaDuration(bgmPath),
      usedDuration: 0
    }
    const bgmDuration = baseContext.bgmDuration || 1
    const totalDuration = transitionEnabled ? composedDuration : duration * safeLoopCount
    let bgmInputArgs: string[] = ['-i', bgmPath]
    const bgmInputIndex = transitionEnabled ? 2 : 1
    const bgmNeedLoop = totalDuration > bgmDuration

    if (mergeMode === 'continuous') {
      const bgmStartTime = baseContext.usedDuration % bgmDuration
      const remainingBgm = bgmDuration - bgmStartTime
      if (totalDuration <= remainingBgm) {
        bgmInputArgs = ['-ss', String(bgmStartTime), '-i', bgmPath]
      } else {
        const bgmLoopCount = Math.ceil(totalDuration / bgmDuration) + 1
        bgmInputArgs = ['-stream_loop', String(bgmLoopCount), '-ss', String(bgmStartTime), '-i', bgmPath]
      }
    } else if (bgmNeedLoop) {
      const bgmLoopCount = Math.max(0, Math.ceil(totalDuration / bgmDuration) - 1)
      bgmInputArgs = ['-stream_loop', String(bgmLoopCount), '-i', bgmPath]
    }

    const hasSourceAudio = await hasAudioStream(inputPath)
    const audioFilter = hasSourceAudio
      ? `${filterComplex};[0:a][${bgmInputIndex}:a]amix=inputs=2:duration=longest:dropout_transition=3[aout]`
      : `${filterComplex};[${bgmInputIndex}:a]asetpts=PTS-STARTPTS[aout]`
    const result = await ffmpeg([
      '-y',
      ...inputArgs,
      ...bgmInputArgs,
      '-filter_complex', audioFilter,
      // `[outv]` 这类流标签原来在命令串里带着引号，那是为了躲开 shell 的方括号globbing；
      // execFile 不经过 shell，ffmpeg 要看到的就是裸的 `[outv]`
      '-map', '[outv]',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      outputPath
    ])

    let mergeContext: LoopVideoContext | undefined
    if (mergeMode === 'continuous') {
      const outputDuration = result.status ? await getMediaDuration(outputPath) : totalDuration
      const validDuration = Number.isFinite(outputDuration) && outputDuration > 0 ? outputDuration : totalDuration
      mergeContext = {
        ...baseContext,
        usedDuration: (baseContext.usedDuration + validDuration) % bgmDuration
      }
    }

    result.status ? logger.debug(`Live Photo 效果视频生成成功: ${outputPath}`) : logger.error('Live Photo 效果视频生成失败', result)
    return { success: result.status, context: mergeContext }
  }

  const result = await ffmpeg([
    '-y',
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    outputPath
  ])
  result.status ? logger.debug(`Live Photo 效果视频生成成功: ${outputPath}`) : logger.error('Live Photo 效果视频生成失败', result)
  return { success: result.status }
}

/**
 * @description 执行一个可执行文件，参数以数组传入、不经过 shell
 *
 * 用 `execFile` 而不是 `exec`：后者把整条命令串交给 `/bin/sh`（Windows 是 cmd.exe），
 * 于是拼进命令的每一个远端字符串都成了潜在的注入点。实测过标题里带一对反引号时
 * POSIX sh 在双引号内仍做命令替换，payload 会真的执行。`execFile` 把 argv 逐个
 * 交给内核，参数里有什么字符都只是那个参数的字面内容，注入面直接消失。
 *
 * `utils/filename.ts` 的清洗仍然保留 —— 那层管的是「能否安全落盘」
 * （文件系统非法字符、长度、控制字符），和这里的注入防护是两件事。
 *
 * @param file - 可执行文件路径
 * @param args - 参数数组，每个元素都是被执行程序看到的字面值
 * @param options - 执行选项
 * @param options.log - 是否打印执行日志
 * @param options.booleanResult - 是否只返回布尔值表示命令是否成功执行
 * @param options.trim - 是否去除输出内容的首尾空白
 * @param options.cwd - 命令执行的工作目录
 *
 * @example
 * const result = await exec('ffmpeg', ['-i', 'input.mp4', 'output.avi'])
 *
 * @example
 * const success = await exec('ffmpeg', ['-version'], { booleanResult: true })
 */
function exec (
  file: string,
  args: FFmpegArgs,
  options: FFmpegExecOptions & { booleanResult: true }
): Promise<boolean>
function exec (
  file: string,
  args: FFmpegArgs,
  options?: FFmpegExecOptions
): Promise<FFmpegExecResult>
function exec (
  file: string,
  args: FFmpegArgs,
  options?: FFmpegExecOptions
): Promise<FFmpegExecResult | boolean> {
  return new Promise(resolve => {
    // 打印执行日志（如果启用）
    if (options?.log) {
      logger.info([
        '[exec] 执行命令:',
        `pwd: ${options?.cwd || process.cwd()}`,
        `file: ${file}`,
        // 逐个参数打印，不拼成一行：拼起来会让「一个带空格的参数」和
        // 「两个参数」在日志里看起来一模一样，排查命令问题时正好需要区分
        `args: ${JSON.stringify(args)}`,
        `options: ${JSON.stringify(options)}`
      ].join('\n'))
    }

    // 执行命令。maxBuffer 保持 Node 默认的 1MB —— 迁移前的 `exec` 也是这个默认值，
    // 这轮只换执行方式、不顺手改行为。真撞到 ENOBUFS 再单独调。
    execFileCmd(file, [...args], options ?? {}, (error, stdout, stderr) => {
      // 打印执行结果日志（如果启用）
      if (options?.log) {
        const info = stringifyError(error || undefined)
        if (info && typeof info === 'object' && 'message' in info && info.message) {
          info.message = `\x1b[91m${info.message}\x1b[0m`
        }
        logger.info([
          '[exec] 执行结果:',
          `stderr: ${stderr.toString()}`,
          `stdout: ${stdout.toString()}`,
          `error: ${JSON.stringify(info, null, 2)}`
        ].join('\n'))
      }

      // 如果只需要布尔值结果
      if (options?.booleanResult) {
        return resolve((!error))
      }

      // 转换输出为字符串
      stdout = stdout.toString()
      stderr = stderr.toString()

      // 去除首尾空白（如果需要）
      if (options?.trim) {
        stdout = stdout.trim()
        stderr = stderr.trim()
      }

      // 构建返回结果
      const value = {
        status: !error,
        error,
        stdout,
        stderr
      }
      resolve(value)
    })
  })
}

/**
 * 诊断日志用的错误序列化结果。
 *
 * 三个具名字段固定存在（可能是 undefined），其余是 Node 挂在错误上的
 * 诊断字段，有就带上。
 */
interface SerializedExecError extends Record<string, unknown> {
  name: string | undefined
  message: string | undefined
  stack: string | undefined
}

/**
 * 把 `execFile` 的错误转成能被 `JSON.stringify` 打出来的普通对象。
 *
 * 为什么必须手动摘字段：`name` / `message` / `stack` 在 `Error` 上是**不可枚举**的，
 * 所以 `JSON.stringify(new Error('boom'))` 的结果是 `{}` —— 直接把错误塞进日志
 * 等于什么都没打。
 *
 * 为什么要 `...error`：原来这里只保留 name/message/stack，而 `ExecFileException`
 * 上真正能定位问题的是那些**可枚举**的自有字段，全被丢掉了。实测两种失败形状：
 * - ffmpeg 没装：`code: 'ENOENT'`、`syscall: 'spawn'`、`path`、`spawnargs`
 * - ffmpeg 退出码非 0：`code: 3`、`killed`、`signal`、`cmd`
 *
 * `code` 是这里面最关键的一个 —— 它区分「程序没找到」和「程序跑了但报错」，
 * 而原来的实现让这两种情况在日志里长得几乎一样。用展开而不是逐个列举，
 * 是因为将来 Node 往错误上加字段时这里不用跟着改。
 *
 * 传 undefined 时三个字段都返回 undefined，这是有意的：`JSON.stringify` 会丢掉
 * 值为 undefined 的属性，所以命令成功那条路径打出来是 `error: {}`，一眼可辨。
 *
 * @param error `execFile` 回调给的错误，命令成功时传 undefined
 * @returns 可直接交给 `JSON.stringify` 的普通对象
 */
const stringifyError = (error?: ExecFileException): SerializedExecError => {
  if (!error) return { name: undefined, message: undefined, stack: undefined }
  const { name, message, stack } = error
  return { ...error, name, message, stack }
}
