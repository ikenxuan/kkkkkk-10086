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
import { exec as execCmd } from 'child_process'
import { logger, Bot, Common } from './index.js'

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
  /**
   * @param {OperationType} type 处理类型
   */
  constructor(type) {
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
  async FFmpeg(opt) {
    // 检查ffmpeg和ffprobe是否可用
    if (!await checkFFmpegAvailable()) {
      throw new Error('FFmpeg工具未安装或不可用')
    }

    switch (this.type) {
      case '二合一（视频 + 音频）': {
        const result = await ffmpeg(`-y -i "${opt.path}" -i "${opt.path2}" -c copy "${opt.resultPath}"`)
        if (result && typeof result === 'object' && 'status' in result) {
          result.status ? logger.mark(`视频合成成功！文件地址：${opt.resultPath}`) : logger.error(result)
          if (opt.callback) await opt.callback(result.status, opt.resultPath)
        }
        return /** @type {MergeFileResult<T>} */ (result)
      }
      case '视频*3 + 音频': {
        const result = await ffmpeg(`-y -stream_loop 2 -i "${opt.path}" -i "${opt.path2}" -filter_complex "[0:v]setpts=N/FRAME_RATE/TB[v];[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=3[aout]" -map "[v]" -map "[aout]" -c:v libx264 -c:a aac -b:a 192k -shortest "${opt.resultPath}"`)
        if (result && typeof result === 'object' && 'status' in result) {
          result.status ? logger.mark(`视频合成成功！文件地址：${opt.resultPath}`) : logger.error(result)
          if (opt.callback) await opt.callback(result.status, opt.resultPath)
        }
        return /** @type {MergeFileResult<T>} */ (result)
      }
      case '获取指定视频文件时长': {
        const result = await ffprobe(`-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${opt.path}"`)
        if (result && typeof result === 'object' && 'stdout' in result) {
          return parseFloat(parseFloat(String(result.stdout).trim()).toFixed(2))
        }
        return 0
      }
      case '压缩视频': {
        if (!opt.targetBitrate) {
          throw new Error('压缩视频需要指定目标比特率')
        }
        const result = await ffmpeg(`-y -i "${opt.path}" -b:v ${opt.targetBitrate}k -maxrate ${opt.maxRate ?? opt.targetBitrate * 1.5}k -bufsize ${opt.bufSize ?? opt.targetBitrate * 2}k -crf ${opt.crf ?? 35} -preset medium -c:v libx264 -vf "scale='if(gte(iw/ih,16/9),1280,-1)':'if(gte(iw/ih,16/9),-1,720)',scale=ceil(iw/2)*2:ceil(ih/2)*2" "${opt.resultPath}"`)
        if (result && typeof result === 'object' && 'status' in result) {
          if (result.status) {
            logger.mark(`视频已压缩并保存到: ${opt.resultPath}`)
            Common.removeFile(opt.path)
          } else {
            logger.error(opt.path + ' 压缩失败！')
            logger.error(result)
          }
        }
        return /** @type {MergeFileResult<T>} */ (opt.resultPath)
      }
      default:
        throw new Error(`不支持的处理类型: ${this.type}`)
    }
  }
}

// 延迟获取 FFmpeg 可执行文件路径，优先级：Bot配置 > 环境变量 > 默认值
const getFFmpegPath = () => Bot?.config?.ffmpeg_path || process.env.FFMPEG_PATH || 'ffmpeg'
const getFFprobePath = () => Bot?.config?.ffprobe_path || process.env.FFPROBE_PATH || 'ffprobe'

/**
 * @description 检查ffmpeg工具是否可用
 * @returns {Promise<boolean>}
 */
const checkFFmpegAvailable = async () => {
  try {
    // 添加延时防止阻塞
    const result = await new Promise(resolve => {
      setTimeout(async () => {
        resolve(await exec(`${getFFmpegPath()} -version`, { booleanResult: true }))
      }, 1000)
    })
    return result
  } catch (error) {
    logger.error('FFmpeg工具检查失败:', error)
    return false
  }
}

/**
 * @description 执行 FFmpeg 命令
 * @param {string} cmd - FFmpeg 命令（不包含 'ffmpeg' 前缀）
 * @param {Object} [options] - 执行选项
 * @param {boolean} [options.log=false] - 是否打印执行日志
 * @param {boolean} [options.booleanResult=false] - 是否只返回执行状态
 * @param {boolean} [options.trim=false] - 是否去除输出内容的首尾空白
 * @param {string} [options.cwd] - 命令执行的工作目录
 * @returns {Promise<{status: boolean, error: Error|null, stdout: string, stderr: string}|boolean>} 返回执行结果或状态对象
 * @property {boolean} status - 命令是否执行成功
 * @property {Error|null} error - 错误信息（如果有）
 * @property {string} stdout - 标准输出
 * @property {string} stderr - 标准错误输出
 * 
 * @example
 * // 转换视频格式
 * const result = await ffmpeg('-i input.mp4 output.avi');
 * 
 * @example
 * // 获取视频信息
 * const info = await ffmpeg('-i input.mp4', { log: true });
 */
export const ffmpeg = async (cmd, options) => {
  // 移除命令前缀并添加完整路径
  cmd = cmd.replace(/^ffmpeg/, '').trim()
  cmd = `${getFFmpegPath()} ${cmd}`
  return await exec(cmd, options)
}

/**
 * @description 执行 FFprobe 命令
 * @param {string} cmd - FFprobe 命令（不包含 'ffprobe' 前缀）
 * @param {Object} [options] - 执行选项
 * @param {boolean} [options.log=false] - 是否打印执行日志
 * @param {boolean} [options.booleanResult=false] - 是否只返回执行状态
 * @param {boolean} [options.trim=false] - 是否去除输出内容的首尾空白
 * @param {string} [options.cwd] - 命令执行的工作目录
 * @returns {Promise<{status: boolean, error: Error|null, stdout: string, stderr: string}|boolean>} 返回执行结果或状态对象
 * @property {boolean} status - 命令是否执行成功
 * @property {Error|null} error - 错误信息（如果有）
 * @property {string} stdout - 标准输出
 * @property {string} stderr - 标准错误输出
 * 
 * @example
 * // 获取视频信息
 * const info = await ffprobe('-i input.mp4');
 * 
 * @example
 * // 获取视频详细信息
 * const details = await ffprobe('-i input.mp4 -show_format -show_streams', { log: true });
 */
export const ffprobe = async (cmd, options) => {
  // 移除命令前缀并添加完整路径
  cmd = cmd.replace(/^ffprobe/, '').trim()
  cmd = `${getFFprobePath()} ${cmd}`
  return await exec(cmd, options)
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
export const mergeFile = async (type, options) => {
  return await new FFmpeg(type).FFmpeg(options)
}

/**
 * @description 执行 shell 命令
 * @param {string} cmd - 要执行的命令
 * @param {Object} [options] - 执行选项
 * @param {boolean} [options.log=false] - 是否打印执行日志
 * @param {boolean} [options.booleanResult=false] - 是否只返回布尔值表示命令是否成功执行
 * @param {boolean} [options.trim=false] - 是否去除输出内容的首尾空白
 * @param {string} [options.cwd] - 命令执行的工作目录
 * @returns {Promise<{status: boolean, error: Error|null, stdout: string, stderr: string}|boolean>} 返回执行结果或状态对象
 * @property {boolean} status - 命令是否执行成功
 * @property {Error|null} error - 错误信息（如果有）
 * @property {string} stdout - 标准输出
 * @property {string} stderr - 标准错误输出
 * 
 * @example
 * // 执行简单命令
 * const result = await exec('ls -la');
 * 
 * @example
 * // 执行命令并获取详细输出
 * const output = await exec('npm test', { log: true });
 * 
 * @example
 * // 只检查命令是否成功
 * const success = await exec('npm test', { booleanResult: true });
 */
const exec = (cmd, options) => {
  return new Promise((resolve) => {
    // 打印执行日志（如果启用）
    if (options?.log) {
      logger.info([
        '[exec] 执行命令:',
        `pwd: ${options?.cwd || process.cwd()}`,
        `cmd: ${cmd}`,
        `options: ${JSON.stringify(options)}`
      ].join('\n'))
    }

    // 执行命令
    execCmd(cmd, options, (error, stdout, stderr) => {
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
 * @description 将错误对象转换为可序列化的格式
 * 这个函数主要用于错误信息的日志记录和调试，将 Error 对象转换为普通对象以便于 JSON 序列化
 * @param {Error|undefined} [error] - 要处理的错误对象，可以是 undefined
 * @returns {{name: string|undefined, message: string|undefined, stack: string|undefined}} 格式化后的错误信息对象
 * @property {string} [name] - 错误名称（如 'Error', 'TypeError' 等）
 * @property {string} [message] - 错误描述信息
 * @property {string} [stack] - 错误堆栈跟踪信息
 * 
 * @example
 * // 处理普通错误
 * try {
 *   someRiskyOperation();
 * } catch (err) {
 *   const errorInfo = stringifyError(err);
 *   console.log(JSON.stringify(errorInfo));
 * }
 * 
 * @example
 * // 处理空值情况
 * const errorInfo = stringifyError(undefined);
 * // 返回: { name: undefined, message: undefined, stack: undefined }
 */
const stringifyError = (error) => {
  if (!error) return { name: undefined, message: undefined, stack: undefined }
  // 解构错误对象的主要属性
  const { name, message, stack } = error
  // 返回格式化后的错误信息
  return { name, message, stack }
}
