import { exec as execCmd } from 'child_process'

class FFmpeg {
  /**
   * @param {string} type 处理类型
   * - '二合一（视频 + 音频）': fffmpegClientOptions['VideoAudioOptions'] 合并视频和音频
   *   - path {string} 文件1绝对路径
   *   - path2 {string} 文件2绝对路径
   *   - resultPath {string} 合并完成后存放的绝对路径
   *   - callback {Function} 处理结果的回调函数
   *
   * - '视频*3 + 音频': fffmpegClientOptions['Video3AudioOptions'] 视频循环3次并合并音频
   *   - path {string} 文件1绝对路径
   *   - path2 {string} 文件2绝对路径
   *   - resultPath {string} 合并完成后存放的绝对路径
   *   - callback {Function} 处理结果的回调函数
   *
   * - '获取指定视频文件时长': fffmpegClientOptions['getVideoSizeOptions'] 获取视频时长
   *   - path {string} 视频文件路径
   *
   * - '压缩视频': fffmpegClientOptions['compressVideoOptions'] 压缩视频文件
   *   - path {string} 文件绝对路径
   *   - targetBitrate {number} 目标比特率
   *   - maxRate {number} 最大码率，默认为 targetBitrate * 1.5
   *   - bufSize {number} 缓冲区大小，默认为 targetBitrate * 2
   *   - crf {number} 恒定码率因子，默认为 30
   *   - resultPath {string} 合并完成后存放的绝对路径
   */
  constructor (type) {
    this.type = type
  }

  /**
   * 使用FFmpeg处理视频文件
   * @param {Object} opt 配置选项
   * @param {string} opt.path 输入视频文件路径
   * @param {string} [opt.path2] 第二个输入文件路径(用于合成)
   * @param {string} opt.resultPath 输出文件路径
   * @param {Function} [opt.callback] 处理完成后的回调函数
   * @param {number} [opt.targetBitrate] 目标比特率(kb/s)
   * @param {number} [opt.maxRate] 最大比特率(kb/s)
   * @param {number} [opt.bufSize] 缓冲大小(kb)
   * @param {number} [opt.crf] CRF值(压缩质量,0-51)
   * @returns {Promise<Object|number|string>} 处理结果
   */
  async FFmpeg (opt) {
    // 检查ffmpeg和ffprobe是否可用
    if (!await checkFFmpegAvailable()) {
      throw new Error('FFmpeg工具未安装或不可用')
    }

    switch (this.type) {
      case '二合一（视频 + 音频）': {
        const result = await ffmpeg(`-y -i "${opt.path}" -i "${opt.path2}" -c copy "${opt.resultPath}"`)
        result.status ? logger.mark(`视频合成成功！文件地址：${opt.resultPath}`) : logger.error(result)
        await opt.callback(result.status, opt.resultPath)
        return result
      }
      case '视频*3 + 音频': {
        const result = await ffmpeg(`-y -stream_loop 2 -i "${opt.path}" -i "${opt.path2}" -filter_complex "[0:v]setpts=N/FRAME_RATE/TB[v];[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=3[aout]" -map "[v]" -map "[aout]" -c:v libx264 -c:a aac -b:a 192k -shortest "${opt.resultPath}"`)
        result ? logger.mark(`视频合成成功！文件地址：${opt.resultPath}`) : logger.error(result)
        await opt.callback(result.status, opt.resultPath)
        return result
      }
      case '获取指定视频文件时长': {
        const { stdout } = await ffprobe(`-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${opt.path}"`)
        return parseFloat(parseFloat(stdout.trim()).toFixed(2))
      }
      case '压缩视频': {
        const result = await ffmpeg(`-y -i "${opt.path}" -b:v ${opt.targetBitrate}k -maxrate ${opt.maxRate ?? opt.targetBitrate * 1.5}k -bufsize ${opt.bufSize ?? opt.targetBitrate * 2}k -crf ${opt.crf ?? 35} -preset medium -c:v libx264 -vf "scale='if(gte(iw/ih,16/9),1280,-1)':'if(gte(iw/ih,16/9),-1,720)',scale=ceil(iw/2)*2:ceil(ih/2)*2" "${opt.resultPath}"`)
        if (result.status) {
          logger.mark(`视频已压缩并保存到: ${opt.resultPath}`)
          Common.removeFile(opt.path)
        } else {
          logger.error(opt.path + ' 压缩失败！')
          logger.error(result)
        }
        return opt.resultPath
      }
    }
  }
}

// 获取 FFmpeg 可执行文件路径，优先级：Bot配置 > 环境变量 > 默认值
const ffmpegPath = Bot?.config?.ffmpeg_path || process.env.FFMPEG_PATH || 'ffmpeg'
const ffprobePath = Bot?.config?.ffprobe_path || process.env.FFPROBE_PATH || 'ffprobe'

/**
 * 检查ffmpeg工具是否可用
 * @returns {Promise<boolean>}
 */
const checkFFmpegAvailable = async () => {
  try {
    const result = await exec(`${ffmpegPath} -version`, { booleanResult: true })
    const probeResult = await exec(`${ffprobePath} -version`, { booleanResult: true })
    return result && probeResult
  } catch (error) {
    logger.error('FFmpeg工具检查失败:', error)
    return false
  }
}

/**
 * @description ffmpeg命令
 * @param cmd 命令
 * @param options 参数
 */
const ffmpeg = async (cmd, options) => {
  cmd = cmd.replace(/^ffmpeg/, '').trim()
  cmd = `${ffmpegPath} ${cmd}`
  return await exec(cmd, options)
}

/**
 * @description ffprobe命令
 * @param cmd 命令
 * @param options 参数
 */
const ffprobe = async (cmd, options) => {
  cmd = cmd.replace(/^ffprobe/, '').trim()
  cmd = `${ffprobePath} ${cmd}`
  return await exec(cmd, options)
}

/**
 * 使用 FFmpeg 对文件进行处理
 * @param type 处理方法
 * @param options 参数
 * @returns
 */
export const mergeFile = async (type, options) => {
  return await new FFmpeg(type).FFmpeg(options)
}

/**
 * 执行 shell 命令
 * @param cmd 命令
 * @param options 选项
 * @param options.log 是否打印日志 默认不打印
 * @param options.booleanResult 是否只返回布尔值 表示命令是否成功执行 默认返回完整的结果
 */
const exec = (cmd, options) => {
  return new Promise((resolve) => {
    if (options?.log) {
      logger.info([
        '[exec] 执行命令:',
        `pwd: ${options?.cwd || process.cwd()}`,
        `cmd: ${cmd}`,
        `options: ${JSON.stringify(options)}`
      ].join('\n'))
    }

    execCmd(cmd, options, (error, stdout, stderr) => {
      if (options?.log) {
        const info = stringifyError(error)
        if (info.message) info.message = `\x1b[91m${info.message}\x1b[0m`
        logger.info([
          '[exec] 执行结果:',
          `stderr: ${stderr.toString()}`,
          `stdout: ${stdout.toString()}`,
          `error: ${JSON.stringify(info, null, 2)}`
        ].join('\n'))
      }

      if (options?.booleanResult) {
        return resolve((!error))
      }

      stdout = stdout.toString()
      stderr = stderr.toString()

      if (options?.trim) {
        stdout = stdout.trim()
        stderr = stderr.trim()
      }

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
