import { ffmpeg, ffprobe } from './FFmpeg.js'
import { Networks } from './Networks.js'
import querystring from 'querystring'
import fetch from 'node-fetch'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'

/** @type {any} */
let core = { pb: { encode: () => { }, decode: () => ({}) }, ApiRejection: Error }
try {
  const icqq = await import('icqq')
  core = icqq.core
} catch {
  try {
    const icqq = await import(`file://${process.cwd()}/plugins/ICQQ-Plugin/node_modules/icqq/lib/index.js`)
    core = icqq.core
  } catch { }
}

const TMP_DIR = os.tmpdir()
const IS_WIN = os.platform() === 'win32'
/** @param {any} data */
const md5 = data => crypto.createHash('md5').update(data).digest()
const uuid = () => crypto.randomUUID()

/**
 * 错误处理对象
 * @typedef {Object} ErrorsObject
 * @property {Object.<string, number>} ErrorCode - 错误代码枚举
 * @property {Object.<number, string>} ErrorMessage - 错误消息映射
 * @property {function(number, [string]): Error} drop - 错误抛出函数
 */
const errors = {}

/**
 * 错误代码枚举
 * @enum {number}
 */
errors.ErrorCode = {
  /** 客户端离线 */
  ClientNotOnline: -1,
  /** 发包超时未收到服务器回应 */
  PacketTimeout: -2,
  /** 用户不存在 */
  UserNotExists: -10,
  /** 群不存在(未加入) */
  GroupNotJoined: -20,
  /** 群员不存在 */
  MemberNotExists: -30,
  /** 发消息时传入的参数不正确 */
  MessageBuilderError: -60,
  /** 群消息被风控发送失败 */
  RiskMessageError: -70,
  /** 群消息有敏感词发送失败 */
  SensitiveWordsError: -80,
  /** 上传图片/文件/视频等数据超时 */
  HighwayTimeout: -110,
  /** 上传图片/文件/视频等数据遇到网络错误 */
  HighwayNetworkError: -120,
  /** 没有上传通道 */
  NoUploadChannel: -130,
  /** 不支持的file类型(没有流) */
  HighwayFileTypeError: -140,
  /** 文件安全校验未通过不存在 */
  UnsafeFile: -150,
  /** 离线(私聊)文件不存在 */
  OfflineFileNotExists: -160,
  /** 群文件不存在(无法转发) */
  GroupFileNotExists: -170,
  /** 获取视频中的图片失败 */
  FFmpegVideoThumbError: -210,
  /** 音频转换失败 */
  FFmpegPttTransError: -220
}

/**
 * 错误消息映射
 * @type {Object.<number, string>}
 */
const ErrorMessage = {
  [errors.ErrorCode.UserNotExists]: '查无此人',
  [errors.ErrorCode.GroupNotJoined]: '未加入的群',
  [errors.ErrorCode.MemberNotExists]: '幽灵群员',
  [errors.ErrorCode.RiskMessageError]: '群消息发送失败，可能被风控',
  [errors.ErrorCode.SensitiveWordsError]: '群消息发送失败，请检查消息内容',
  10: '消息过长',
  34: '消息过长',
  120: '在该群被禁言',
  121: 'AT全体剩余次数不足'
}

/**
 * 改进的错误抛出函数
 * @param {number} code 错误代码
 * @param {string} [message] 错误信息
 * @throws {core.ApiRejection} API错误异常
 */
errors.drop = function (code, message) {
  if (!message || !message.length) {
    message = ErrorMessage[code]
  }
  throw new core.ApiRejection(code, message)
}

/**
 * 上传高清语音
 * @param {any} e 事件对象
 * @param {any} record_url 音频地址
 * @param {number} seconds 音频时长
 * @param {boolean} transcoding 是否转码
 * @param {string} brief 简介
 * @returns {Promise<any>} 返回语音消息对象
 */
async function UploadRecord(e, record_url, seconds = 0, transcoding = true, brief = '') {
  const bot = Array.isArray(Bot.uin) ? Bot[e.self_id].sdk : Bot

  // 首先准备音频文件（下载、转换等）
  let filePath
  let cleanupFile = false
  try {
    filePath = await prepareAudioFile(record_url)
    cleanupFile = !filePath.startsWith(TMP_DIR) // 如果是临时文件，需要清理

    // 如果没有上传高清语音功能，直接返回转换后的音频
    if (!bot?.sendUni) {
      const silkBuffer = await audioTrans(filePath)
      if (!silkBuffer) return false
      return {
        type: 'record',
        file: `base64://${silkBuffer.toString('base64')}`
      }
    }

    // 然后获取音频buffer和时长
    const result = await getPttBuffer(filePath, transcoding)
    if (!result.buffer) return false

    const buf = result.buffer
    if (seconds === 0 && result.time) seconds = result.time.seconds
    const hash = md5(buf)
    let codec = 0
    try {
      const { isSilk } = await import('silk-wasm')
      codec = isSilk(buf) ? (transcoding ? 1 : 0) : 0
    } catch {
      codec = buf.subarray(0, 7).toString().includes('SILK') ? (transcoding ? 1 : 0) : 0
    }

    const body = core.pb.encode({
      1: 3, 2: 3,
      5: {
        1: bot.uin, 2: bot.uin, 3: 0, 4: hash, 5: buf.length, 6: hash,
        7: 5, 8: 9, 9: 4, 10: bot.apk?.version || '9.0.50', 11: 0,
        12: 1, 13: 1, 14: codec, 15: 1
      }
    })

    const payload = await bot.sendUni('PttStore.GroupPttUp', body)
    const rsp = core.pb.decode(payload)[5]
    if (rsp[2]) errors.drop(rsp[2], rsp[3])

    const ip = rsp[5]?.[0] || rsp[5]
    const port = rsp[6]?.[0] || rsp[6]
    const params = {
      ver: 4679,
      ukey: rsp[7].toHex(),
      filekey: rsp[11].toHex(),
      filesize: buf.length,
      bmd5: hash.toString('hex'),
      mType: 'pttDu',
      voice_encodec: codec
    }

    await fetch(`http://${int32ip2str(ip)}:${port}/?${querystring.stringify(params)}`, {
      method: 'POST',
      headers: {
        'User-Agent': `QQ/${bot.apk.version} CFNetwork/1126`,
        'Net-Type': 'Wifi'
      },
      body: buf
    })

    const fid = rsp[11].toBuffer()
    const b = core.pb.encode({
      1: 4, 2: bot.uin, 3: fid, 4: hash,
      5: hash.toString('hex') + '.amr', 6: seconds, 11: 1,
      18: fid, 19: seconds, 29: codec,
      30: { 1: 0, 5: 0, 6: 'sss', 7: 0, 8: brief }
    })

    return {
      type: 'record',
      file: 'protobuf://' + Buffer.from(b).toString('base64')
    }
  } catch (error) {
    logger.error('上传语音失败:', error)
    return false
  } finally {
    // 清理临时文件
    if (cleanupFile && filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => { })
    }
  }
}

/**
 * 下载并准备音频文件
 * @param {any} file 音频文件路径、URL、Buffer或base64数据
 * @returns {Promise<string>} 返回本地文件路径
 */
async function prepareAudioFile(file) {
  let filePath = `${TMP_DIR}/${uuid()}`

  try {
    // 检查 file 是否为 Buffer 实例或 base64 编码的数据
    if (Buffer.isBuffer(file) || file.startsWith('base64://')) {
      const base64Data = file.startsWith('base64://') ? file.substring('base64://'.length) : file.toString('base64')
      const buffer = Buffer.from(base64Data, 'base64')
      await fs.promises.writeFile(filePath, new Uint8Array(buffer))
    }
    // 如果 file 是一个 URL
    else if (file.startsWith('http://') || file.startsWith('https://')) {
      // 使用 Networks 下载文件
      const network = new Networks({
        url: file,
        filepath: filePath,
        headers: { 'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; MI 9 Build/SKQ1.211230.001)' },
        timeout: 30000
      })

      try {
        await network.downloadStream((downloaded, total) => {
          if (total > 0) {
            const percentage = Math.floor((downloaded / total) * 100)
            logger.info(`下载音频文件进度: ${percentage}% (${downloaded}/${total} bytes)`)
          }
        })
      } catch (error) {
        throw new Error(`下载音频文件失败: ${error}`)
      } finally {
        network.cleanup()
      }
    }
    // 如果 file 是一个本地文件 URI 或者是一个存在的本地文件路径
    else if (file.startsWith('file://') || await fs.promises.access(file).then(() => true).catch(() => false)) {
      // 移除 file:// 前缀
      let localFile = file.replace(/^file:\/\/\//, '')
      // Windows 系统可能需要移除前导斜杠
      if (IS_WIN && localFile.startsWith('/')) localFile = localFile.slice(1)
      filePath = localFile
    }
    // 如果 file 不是有效的文件路径
    else {
      throw new Error('提供的路径不是有效的文件、URL 或 base64 数据。')
    }
  } catch (error) {
    // 清理临时文件
    if (filePath !== file && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => { })
    }
    throw new Error('准备音频文件失败: ' + error)
  }

  return filePath
}

/**
 * 获取PTT音频缓冲区
 * @param {string} filePath 音频文件路径（必须是已存在的本地文件）
 * @param {boolean} transcoding 是否转码
 * @returns {Promise<{buffer: Buffer, time: any}>} 返回音频缓冲区和时长信息
 */
async function getPttBuffer(filePath, transcoding = true) {
  /** @type {Buffer} */
  let buffer = Buffer.alloc(0)
  let time

  try {
    // 读取文件前7个字节用于检测音频格式
    const head = await read7Bytes(filePath)

    // 获取音频时长信息
    const result = await getAudioTime(filePath)
    if (result.code === 1) time = result.data

    // 读取文件buffer
    const fileBuffer = await fs.promises.readFile(filePath)

    try {
      const { isSilk } = await import('silk-wasm')
      if (isSilk(fileBuffer) || head.toString().includes('AMR') || !transcoding) {
        buffer = result.buffer ?? fileBuffer
      } else {
        const transResult = await audioTrans(filePath)
        buffer = transResult || fileBuffer
      }
    } catch {
      // 降级到原有检测方式
      if (head.toString().includes('SILK') || head.toString().includes('AMR') || !transcoding) {
        buffer = result.buffer ?? fileBuffer
      } else {
        const transResult = await audioTrans(filePath)
        buffer = transResult || fileBuffer
      }
    }
  } catch (error) {
    logger.error('获取音频buffer失败:', error)
  }

  return { buffer, time }
}

/**
 * 获取音频时长信息
 * @param {string} file 音频文件路径
 * @returns {Promise<{code: number, buffer?: Buffer, data?: any}>} 返回音频时长和相关信息
 */
async function getAudioTime(file) {
  try {
    // 先尝试使用 silk-wasm 获取 SILK 音频时长
    const { isSilk, getDuration, isWav, getWavFileInfo } = await import('silk-wasm')
    const fileBuffer = await fs.promises.readFile(file)

    if (isSilk(fileBuffer)) {
      const duration = getDuration(fileBuffer) / 1000 // 转换为秒
      const time = new Date(duration * 1000).toISOString().slice(11, 19)
      return {
        code: 1,
        data: { time, seconds: Math.floor(duration), exec_text: 'SILK duration detected' }
      }
    }

    if (isWav(fileBuffer)) {
      const { fmt } = getWavFileInfo(fileBuffer)
      const duration = fileBuffer.length / (fmt.sampleRate * fmt.numberOfChannels * (fmt.bitsPerSample / 8))
      const time = new Date(duration * 1000).toISOString().slice(11, 19)
      return {
        code: 1,
        data: { time, seconds: Math.floor(duration), exec_text: 'WAV duration calculated' }
      }
    }
  } catch {
    // 如果 silk-wasm 不可用，降级到 FFmpeg
  }

  // 降级到 FFmpeg 方式
  try {
    const fileInfo = fs.statSync(file)
    const isLarge = fileInfo.size >= 10485760

    if (isLarge) {
      // 大文件处理：先转换再获取时长
      const result = await ffmpeg(`-y -i "${file}" -fs 10485600 -ab 128k "${file}.mp3"`)
      if (result && typeof result === 'object' && 'status' in result && result.status) {
        const buffer = fs.readFileSync(`${file}.mp3`)
        fs.unlinkSync(`${file}.mp3`)

        // 使用 ffprobe 获取转换后文件的时长
        const probeResult = await ffprobe(`-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}.mp3"`)
        if (probeResult && typeof probeResult === 'object' && 'status' in probeResult && probeResult.status && probeResult.stdout) {
          const duration = parseFloat(probeResult.stdout.trim())
          const time = new Date(duration * 1000).toISOString().slice(11, 19)
          return {
            code: 1,
            buffer,
            data: { time, seconds: Math.floor(duration), exec_text: probeResult.stderr }
          }
        }
      }
    } else {
      // 小文件直接使用 ffprobe 获取时长
      const result = await ffprobe(`-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`)
      if (result && typeof result === 'object' && 'status' in result && result.status && result.stdout) {
        const duration = parseFloat(result.stdout.trim())
        const time = new Date(duration * 1000).toISOString().slice(11, 19)
        return {
          code: 1,
          data: { time, seconds: Math.floor(duration), exec_text: result.stderr }
        }
      }
    }

    return { code: -1 }
  } catch {
    return { code: -1 }
  }
}

/**
 * 音频转码为SILK格式
 * @param {string} file 音频文件路径
 * @returns {Promise<Buffer|false>} 返回转码后的SILK音频数据
 */
async function audioTrans(file) {
  try {
    const { encode, isSilk, isWav, getWavFileInfo } = await import('silk-wasm')
    const fileBuffer = await fs.promises.readFile(file)

    // 如果已经是 SILK 格式，直接返回
    if (isSilk(fileBuffer)) {
      return fileBuffer
    }

    // 如果是 WAV 格式，检查采样率
    if (isWav(fileBuffer)) {
      const { fmt } = getWavFileInfo(fileBuffer)
      const allowSampleRate = [8000, 12000, 16000, 24000, 32000, 44100, 48000]

      if (allowSampleRate.includes(fmt.sampleRate)) {
        // 直接使用 WAV 数据进行 SILK 编码
        const silkData = await encode(fileBuffer, fmt.sampleRate)
        return Buffer.from(silkData.data)
      }
    }

    // 其他格式或不支持的采样率，使用 FFmpeg 转换
    const tmpfile = `${TMP_DIR}/${uuid()}.pcm`

    try {
      const result = await ffmpeg(`-y -i "${file}" -f s16le -ar 24000 -ac 1 "${tmpfile}"`)
      if (result && typeof result === 'object' && 'status' in result && result.status) {
        const pcmData = await fs.promises.readFile(tmpfile)
        const silkData = await encode(pcmData, 24000)
        return Buffer.from(silkData.data)
      } else {
        return await audioTransFallback(file)
      }
    } catch {
      return await audioTransFallback(file)
    } finally {
      fs.unlink(tmpfile, () => { })
    }
  } catch {
    // 如果 silk-wasm 不可用，降级到原有方式
    return audioTransFallback(file)
  }
}

/**
 * 音频转码降级处理（转为AMR格式）
 * @param {string} file 音频文件路径
 * @returns {Promise<Buffer|false>} 返回转码后的AMR音频数据
 */
async function audioTransFallback(file) {
  const tmpfile = `${TMP_DIR}/${uuid()}`

  try {
    const result = await ffmpeg(`-y -i "${file}" -ac 1 -ar 8000 -f amr "${tmpfile}"`)
    if (result && typeof result === 'object' && 'status' in result && result.status) {
      const amr = await fs.promises.readFile(tmpfile)
      return amr
    } else {
      return false
    }
  } catch {
    return false
  } finally {
    fs.unlink(tmpfile, () => { })
  }
}

/**
 * 读取文件前7个字节（用于检测音频格式）
 * @param {string} file 文件路径
 * @returns {Promise<Buffer>} 返回前7个字节的Buffer
 */
async function read7Bytes(file) {
  const fd = await fs.promises.open(file, 'r')
  try {
    const buf = new Uint8Array(7)
    const { buffer } = await fd.read(buf, 0, 7, 0)
    return Buffer.from(buffer)
  } finally {
    await fd.close()
  }
}

/**
 * 将32位整数IP转换为字符串格式
 * @param {any} ip 32位整数IP或字符串IP
 * @returns {string} 返回点分十进制IP字符串
 */
function int32ip2str(ip) {
  if (typeof ip === 'string') return ip
  ip = ip & 0xffffffff
  return [
    ip & 0xff,
    (ip & 0xff00) >> 8,
    (ip & 0xff0000) >> 16,
    ((ip & 0xff000000) >> 24) & 0xff
  ].join('.')
}

export default UploadRecord
