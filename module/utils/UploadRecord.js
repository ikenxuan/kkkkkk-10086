import { Bot } from '../utils/index.js'
import querystring from 'querystring'
import { exec } from 'child_process'
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

const errors = {
  /** 
   * 抛出API错误
   * @param {number} code 错误代码
   * @param {string} message 错误信息
   */
  drop(code, message) {
    throw new core.ApiRejection(code, message)
  }
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
  const result = await getPttBuffer(record_url, bot.config?.ffmpeg_path, transcoding)
  if (!result.buffer) return false

  // 如果没有上传高清语音功能，直接返回转换后的音频
  if (!bot?.sendUni) {
    const silkBuffer = await audioTrans(record_url, bot.config?.ffmpeg_path)
    if (!silkBuffer) return false
    return {
      type: 'record',
      file: `base64://${silkBuffer.toString('base64')}`
    }
  }

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
}

/**
 * 获取PTT音频缓冲区
 * @param {any} file 音频文件路径或Buffer
 * @param {string} ffmpeg FFmpeg路径
 * @param {boolean} transcoding 是否转码
 * @returns {Promise<{buffer: Buffer, time: any}>} 返回音频缓冲区和时长信息
 */
async function getPttBuffer(file, ffmpeg = 'ffmpeg', transcoding = true) {
  /** @type {Buffer} */
  let buffer = Buffer.alloc(0)
  let time

  if (file instanceof Buffer || file.startsWith('base64://')) {
    let buf = file instanceof Buffer ? file : Buffer.from(file.slice(9), 'base64')
    const head = buf.subarray(0, 7).toString()
    const tmpfile = `${TMP_DIR}/${uuid()}`

    await fs.promises.writeFile(tmpfile, new Uint8Array(buf))
    const result = await getAudioTime(tmpfile, ffmpeg)
    if (result.code === 1) time = result.data

    try {
      const { isSilk } = await import('silk-wasm')
      if (isSilk(buf) || head.includes('AMR') || !transcoding) {
        buffer = result.buffer ?? buf
      } else {
        const transResult = await audioTrans(tmpfile, ffmpeg)
        buffer = transResult || buf
      }
    } catch {
      // 降级到原有检测方式
      if (head.includes('SILK') || head.includes('AMR') || !transcoding) {
        buffer = result.buffer ?? buf
      } else {
        const transResult = await audioTrans(tmpfile, ffmpeg)
        buffer = transResult || buf
      }
    }
    fs.unlink(tmpfile, () => { })
  }
  else if (file.startsWith('http://') || file.startsWith('https://')) {
    try {
      const response = await fetch(file, {
        headers: { 'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; MI 9 Build/SKQ1.211230.001)' }
      })
      const buf = Buffer.from(await response.arrayBuffer())
      const tmpfile = `${TMP_DIR}/${uuid()}`

      await fs.promises.writeFile(tmpfile, new Uint8Array(buf))
      const head = await read7Bytes(tmpfile)
      const result = await getAudioTime(tmpfile, ffmpeg)
      if (result.code === 1) time = result.data

      try {
        const { isSilk } = await import('silk-wasm')
        if (isSilk(buf) || head.toString().includes('AMR') || !transcoding) {
          buffer = result.buffer ?? buf
        } else {
          const transResult = await audioTrans(tmpfile, ffmpeg)
          buffer = transResult || buf
        }
      } catch {
        // 降级到原有检测方式
        if (head.toString().includes('SILK') || head.toString().includes('AMR') || !transcoding) {
          buffer = result.buffer ?? buf
        } else {
          const transResult = await audioTrans(tmpfile, ffmpeg)
          buffer = transResult || buf
        }
      }

      fs.unlink(tmpfile, () => { })
    } catch (err) {
      console.error('Failed to fetch audio:', err)
    }
  }
  else {
    file = String(file).replace(/^file:\/{2}/, '')
    if (IS_WIN && file.startsWith('/')) file = file.slice(1)

    const head = await read7Bytes(file)
    const result = await getAudioTime(file, ffmpeg)
    if (result.code === 1) time = result.data

    try {
      const { isSilk } = await import('silk-wasm')
      const fileBuffer = await fs.promises.readFile(file)
      if (isSilk(fileBuffer) || head.toString().includes('AMR') || !transcoding) {
        buffer = result.buffer ?? fileBuffer
      } else {
        const transResult = await audioTrans(file, ffmpeg)
        buffer = transResult || fileBuffer
      }
    } catch {
      // 降级到原有检测方式
      if (head.toString().includes('SILK') || head.toString().includes('AMR') || !transcoding) {
        buffer = result.buffer ?? await fs.promises.readFile(file)
      } else {
        const transResult = await audioTrans(file, ffmpeg)
        buffer = transResult || await fs.promises.readFile(file)
      }
    }
  }

  return { buffer, time }
}

/**
 * 获取音频时长信息
 * @param {string} file 音频文件路径
 * @param {string} ffmpeg FFmpeg路径
 * @returns {Promise<{code: number, buffer?: Buffer, data?: any}>} 返回音频时长和相关信息
 */
async function getAudioTime(file, ffmpeg = 'ffmpeg') {
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
  return new Promise(resolve => {
    const fileInfo = fs.statSync(file)
    const isLarge = fileInfo.size >= 10485760
    const cmd = isLarge
      ? `${ffmpeg} -i "${file}" -fs 10485600 -ab 128k "${file}.mp3"`
      : `${ffmpeg} -i "${file}"`

    exec(cmd, async (error, stdout, /** @type {string} */ stderr) => {
      try {
        let buffer = undefined
        if (isLarge) {
          buffer = fs.readFileSync(`${file}.mp3`)
          fs.unlinkSync(`${file}.mp3`)
        }

        const time = stderr.split('Duration:')[1]?.split(',')[0]?.trim()
        const arr = time?.split(':')
        if (!arr || !time || !time.length) return resolve({ code: -1 })

        arr.reverse()
        let seconds = 0, multiplier = 1
        for (const val of arr) {
          if (parseInt(val) > 0) seconds += parseInt(val) * multiplier
          multiplier *= 60
        }

        resolve({
          code: 1,
          buffer,
          data: { time, seconds, exec_text: stderr }
        })
      } catch {
        resolve({ code: -1 })
      }
    })
  })
}

/**
 * 音频转码为SILK格式
 * @param {string} file 音频文件路径
 * @param {string} ffmpeg FFmpeg路径
 * @returns {Promise<Buffer|false>} 返回转码后的SILK音频数据
 */
async function audioTrans(file, ffmpeg = 'ffmpeg') {
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

    return new Promise(resolve => {
      exec(`${ffmpeg} -y -i "${file}" -f s16le -ar 24000 -ac 1 -fs 31457280 "${tmpfile}"`, async () => {
        try {
          const pcmData = await fs.promises.readFile(tmpfile)
          const silkData = await encode(pcmData, 24000)
          resolve(Buffer.from(silkData.data))
        } catch {
          resolve(await audioTransFallback(file, ffmpeg))
        } finally {
          fs.unlink(tmpfile, () => { })
        }
      })
    })
  } catch {
    // 如果 silk-wasm 不可用，降级到原有方式
    return audioTransFallback(file, ffmpeg)
  }
}

/**
 * 音频转码降级处理（转为AMR格式）
 * @param {string} file 音频文件路径
 * @param {string} ffmpeg FFmpeg路径
 * @returns {Promise<Buffer|false>} 返回转码后的AMR音频数据
 */
async function audioTransFallback(file, ffmpeg = 'ffmpeg') {
  const tmpfile = `${TMP_DIR}/${uuid()}`

  return new Promise(resolve => {
    exec(`${ffmpeg} -y -i "${file}" -ac 1 -ar 8000 -f amr "${tmpfile}"`, async () => {
      try {
        const amr = await fs.promises.readFile(tmpfile)
        resolve(amr)
      } catch {
        resolve(false)
      } finally {
        fs.unlink(tmpfile, () => { })
      }
    })
  })
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
