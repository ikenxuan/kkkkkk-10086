import querystring from 'querystring'
import { exec } from 'child_process'
import fetch from 'node-fetch'
import stream from 'stream'
import crypto from 'crypto'
import util from 'util'
import fs from 'fs'
import os from 'os'

let core
try {
  ; ({ core } = await import('icqq'))
} catch {
  try {
    ; ({ core } = await import(`file://${process.cwd()}/plugins/ICQQ-Plugin/node_modules/icqq/lib/index.js`))
  } catch {
    ; ({ core } = {})
  }
}

const errors = {}

async function UploadRecord (e, record_url, seconds = 0, transcoding = true, brief = '') {
  const bot = Array.isArray(Bot.uin) ? Bot[e.self_id].sdk : Bot
  const result = await getPttBuffer(record_url, bot.config?.ffmpeg_path, transcoding)
  if (!result.buffer) {
    return false
  }
  const buf = result.buffer
  if (seconds == 0 && result.time) seconds = result.time.seconds
  const hash = (0, md5)(buf)
  const codec = String(buf.slice(0, 7)).includes('SILK') ? (transcoding ? 1 : 0) : 0
  const body = core.pb.encode({
    1: 3,
    2: 3,
    5: {
      1: bot.uin,
      2: bot.uin,
      3: 0,
      4: hash,
      5: buf.length,
      6: hash,
      7: 5,
      8: 9,
      9: 4,
      11: 0,
      10: bot.apk?.version || '9.0.50',
      12: 1,
      13: 1,
      14: codec,
      15: 1
    }
  })
  const payload = await bot.sendUni('PttStore.GroupPttUp', body)
  const rsp = core.pb.decode(payload)[5]
  rsp[2] && (0, errors.drop)(rsp[2], rsp[3])
  const ip = rsp[5]?.[0] || rsp[5]
  const port = rsp[6]?.[0] || rsp[6]
  const ukey = rsp[7].toHex()
  const filekey = rsp[11].toHex()
  const params = {
    ver: 4679,
    ukey,
    filekey,
    filesize: buf.length,
    bmd5: hash.toString('hex'),
    mType: 'pttDu',
    voice_encodec: codec
  }
  const url = `http://${(0, int32ip2str)(ip)}:${port}/?` + querystring.stringify(params)
  const headers = {
    'User-Agent': `QQ/${bot.apk.version} CFNetwork/1126`,
    'Net-Type': 'Wifi'
  }
  await fetch(url, {
    method: 'POST', // post请求
    headers,
    body: buf
  })
  // await axios.post(url, buf, { headers });

  const fid = rsp[11].toBuffer()
  const b = core.pb.encode({
    1: 4,
    2: bot.uin,
    3: fid,
    4: hash,
    5: hash.toString('hex') + '.amr',
    6: seconds,
    11: 1,
    18: fid,
    19: seconds,
    29: codec,
    30: {
      1: 0, // 是否为变声语音
      5: 0, // 是否显示评级
      6: 'sss', // 评级
      7: 0, // 未知参数
      8: brief
    }
  })
  return {
    type: 'record',
    file: 'protobuf://' + Buffer.from(b).toString('base64')
  }
}

export default UploadRecord

async function getPttBuffer (file, ffmpeg = 'ffmpeg', transcoding = true) {
  let buffer
  let time
  if (file instanceof Buffer || file.startsWith('base64://')) {
    // Buffer或base64
    let buf = file instanceof Buffer ? file : Buffer.from(file.slice(9), 'base64')
    const head = buf.slice(0, 7).toString()
    if (head.includes('SILK') || head.includes('AMR') || !transcoding) {
      const tmpfile = TMP_DIR + '/' + (0, uuid)()
      await fs.promises.writeFile(tmpfile, buf)
      const result = await getAudioTime(tmpfile, ffmpeg)
      if (result.code == 1) time = result.data
      buf = await fs.promises.readFile(tmpfile)
      fs.unlink(tmpfile, NOOP)
      buffer = result.buffer || buf
    } else {
      const tmpfile = TMP_DIR + '/' + (0, uuid)()
      const result = await getAudioTime(tmpfile, ffmpeg)
      if (result.code == 1) time = result.data
      await fs.promises.writeFile(tmpfile, buf)
      buffer = await audioTrans(tmpfile, ffmpeg)
      fs.unlink(tmpfile, NOOP)
    }
  } else if (file.startsWith('http://') || file.startsWith('https://')) {
    // 网络文件
    // const readable = (await axios.get(file, { responseType: "stream" })).data;
    try {
      const headers = {
        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 12; MI 9 Build/SKQ1.211230.001)'
      }
      const response = await fetch(file, {
        method: 'GET', // post请求
        headers
      })
      const buf = Buffer.from(await response.arrayBuffer())
      const tmpfile = TMP_DIR + '/' + (0, uuid)()
      await fs.promises.writeFile(tmpfile, buf)
      // await (0, pipeline)(readable.pipe(new DownloadTransform), fs.createWriteStream(tmpfile));
      const head = await read7Bytes(tmpfile)
      const result = await getAudioTime(tmpfile, ffmpeg)
      if (result.code == 1) time = result.data
      if (head.includes('SILK') || head.includes('AMR') || !transcoding) {
        buffer = result.buffer || buf
      } else {
        buffer = await audioTrans(tmpfile, ffmpeg)
      }
      fs.unlink(tmpfile, NOOP)
    } catch (err) { }
  } else {
    // 本地文件
    file = String(file).replace(/^file:\/{2}/, '')
    IS_WIN && file.startsWith('/') && (file = file.slice(1))
    const head = await read7Bytes(file)
    const result = await getAudioTime(file, ffmpeg)
    if (result.code == 1) time = result.data
    if (head.includes('SILK') || head.includes('AMR') || !transcoding) {
      buffer = result.buffer || (await fs.promises.readFile(file))
    } else {
      buffer = await audioTrans(file, ffmpeg)
    }
  }
  return { buffer, time }
}

async function getAudioTime (file, ffmpeg = 'ffmpeg') {
  return new Promise((resolve, reject) => {
    const file_info = fs.statSync(file)
    let cmd = `${ffmpeg} -i "${file}"`
    let is_aac = false
    if (file_info.size >= 10485760) {
      cmd = `${ffmpeg} -i "${file}" -fs 10485600 -ab 128k "${file}.mp3"`
      is_aac = true
    }
    exec(cmd, async (error, stdout, stderr) => {
      try {
        let buffer = null
        if (is_aac) {
          buffer = fs.readFileSync(`${file}.mp3`)
          fs.unlinkSync(`${file}.mp3`)
        }
        const time = stderr.split('Duration:')[1]?.split(',')[0].trim()
        const arr = time?.split(':')
        arr.reverse()
        let n = 1
        let s = 0
        for (const val of arr) {
          if (parseInt(val) > 0) s += parseInt(val) * n
          n *= 60
        }
        resolve({
          code: 1,
          buffer,
          data: {
            time,
            seconds: s,
            exec_text: stderr
          }
        })
      } catch (err) {
        resolve({ code: -1 })
      }
    })
  })
}

async function audioTrans (file, ffmpeg = 'ffmpeg') {
  const result = await new Promise((resolve, reject) => {
    const tmpfile = TMP_DIR + '/' + (0, uuid)() + '.pcm'
    exec(`${ffmpeg} -y -i "${file}" -f s16le -ar 24000 -ac 1 -fs 31457280 "${tmpfile}"`, async (error, stdout, stderr) => {
      try {
        const silk_worker = await import('./silk_worker/index.cjs')
        const ret = await silk_worker.encode(tmpfile, 24000)
        resolve(Buffer.from(ret.data))
      } catch (err) {
        logger.error('音频转码到pcm失败，请确认你的ffmpeg可以处理此转换')
        resolve(false)
      } finally {
        fs.unlink(tmpfile, NOOP)
      }
    })
  })
  if (result) return result
  return await audioTrans1(file, ffmpeg)
}

async function audioTrans1 (file, ffmpeg = 'ffmpeg') {
  return new Promise((resolve, reject) => {
    const tmpfile = TMP_DIR + '/' + (0, uuid)()
    exec(`${ffmpeg} -y -i "${file}" -ac 1 -ar 8000 -f amr "${tmpfile}"`, async (error, stdout, stderr) => {
      try {
        const amr = await fs.promises.readFile(tmpfile)
        resolve(amr)
      } catch (err) {
        logger.error('音频转码到amr失败，请确认你的ffmpeg可以处理此转换')
        resolve(false)
      } finally {
        fs.unlink(tmpfile, NOOP)
      }
    })
  })
}

async function read7Bytes (file) {
  const fd = await fs.promises.open(file, 'r')
  const buf = (await fd.read(Buffer.alloc(7), 0, 7, 0)).buffer
  fd.close()
  return buf
}

function uuid () {
  const hex = crypto.randomBytes(16).toString('hex')
  return hex.substr(0, 8) + '-' + hex.substr(8, 4) + '-' + hex.substr(12, 4) + '-' + hex.substr(16, 4) + '-' + hex.substr(20)
}

/** 计算流的md5 */
function md5Stream (readable) {
  return new Promise((resolve, reject) => {
    readable.on('error', reject)
    readable.pipe(crypto.createHash('md5').on('error', reject).on('data', resolve))
  })
}

/** 计算文件的md5和sha */
function fileHash (filepath) {
  const readable = fs.createReadStream(filepath)
  const sha = new Promise((resolve, reject) => {
    readable.on('error', reject)
    readable.pipe(crypto.createHash('sha1').on('error', reject).on('data', resolve))
  })
  return Promise.all([ md5Stream(readable), sha ])
}

/** 群号转uin */
function code2uin (code) {
  let left = Math.floor(code / 1000000)
  if (left >= 0 && left <= 10) left += 202
  else if (left >= 11 && left <= 19) left += 469
  else if (left >= 20 && left <= 66) left += 2080
  else if (left >= 67 && left <= 156) left += 1943
  else if (left >= 157 && left <= 209) left += 1990
  else if (left >= 210 && left <= 309) left += 3890
  else if (left >= 310 && left <= 335) left += 3490
  else if (left >= 336 && left <= 386) left += 2265
  else if (left >= 387 && left <= 499) left += 3490
  return left * 1000000 + (code % 1000000)
}

/** uin转群号 */
function uin2code (uin) {
  let left = Math.floor(uin / 1000000)
  if (left >= 202 && left <= 212) left -= 202
  else if (left >= 480 && left <= 488) left -= 469
  else if (left >= 2100 && left <= 2146) left -= 2080
  else if (left >= 2010 && left <= 2099) left -= 1943
  else if (left >= 2147 && left <= 2199) left -= 1990
  else if (left >= 2600 && left <= 2651) left -= 2265
  else if (left >= 3800 && left <= 3989) left -= 3490
  else if (left >= 4100 && left <= 4199) left -= 3890
  return left * 1000000 + (uin % 1000000)
}

function int32ip2str (ip) {
  if (typeof ip === 'string') return ip
  ip = ip & 0xffffffff
  return [ ip & 0xff, (ip & 0xff00) >> 8, (ip & 0xff0000) >> 16, ((ip & 0xff000000) >> 24) & 0xff ].join('.')
}

/** 解析彩色群名片 */
function parseFunString (buf) {
  if (buf[0] === 0xa) {
    let res = ''
    try {
      let arr = core.pb.decode(buf)[1]
      if (!Array.isArray(arr)) arr = [ arr ]
      for (const v of arr) {
        if (v[2]) res += String(v[2])
      }
    } catch { }
    return res
  } else {
    return String(buf)
  }
}

/** xml转义 */
function escapeXml (str) {
  return str.replace(/[&"><]/g, function (s) {
    if (s === '&') return '&amp;'
    if (s === '<') return '&lt;'
    if (s === '>') return '&gt;'
    if (s === '"') return '&quot;'
    return ''
  })
}

/** 用于下载限量 */
class DownloadTransform extends stream.Transform {
  constructor () {
    super(...arguments)
    this._size = 0
  }

  _transform (data, encoding, callback) {
    this._size += data.length
    let error = null
    if (this._size <= MAX_UPLOAD_SIZE) this.push(data)
    else error = new Error('downloading over 30MB is refused')
    callback(error)
  }
}
const IS_WIN = os.platform() === 'win32'
/** 系统临时目录，用于临时存放下载的图片等内容 */
const TMP_DIR = os.tmpdir()
/** 最大上传和下载大小，以图片上传限制为准：30MB */
const MAX_UPLOAD_SIZE = 31457280

/** no operation */
const NOOP = () => { }

/** promisified pipeline */
const pipeline = (0, util.promisify)(stream.pipeline)
/** md5 hash */
const md5 = (data) => (0, crypto.createHash)('md5').update(data).digest()

errors.LoginErrorCode = errors.drop = errors.ErrorCode
let ErrorCode
(function (ErrorCode) {
  /** 客户端离线 */
  ErrorCode[(ErrorCode.ClientNotOnline = -1)] = 'ClientNotOnline'
  /** 发包超时未收到服务器回应 */
  ErrorCode[(ErrorCode.PacketTimeout = -2)] = 'PacketTimeout'
  /** 用户不存在 */
  ErrorCode[(ErrorCode.UserNotExists = -10)] = 'UserNotExists'
  /** 群不存在(未加入) */
  ErrorCode[(ErrorCode.GroupNotJoined = -20)] = 'GroupNotJoined'
  /** 群员不存在 */
  ErrorCode[(ErrorCode.MemberNotExists = -30)] = 'MemberNotExists'
  /** 发消息时传入的参数不正确 */
  ErrorCode[(ErrorCode.MessageBuilderError = -60)] = 'MessageBuilderError'
  /** 群消息被风控发送失败 */
  ErrorCode[(ErrorCode.RiskMessageError = -70)] = 'RiskMessageError'
  /** 群消息有敏感词发送失败 */
  ErrorCode[(ErrorCode.SensitiveWordsError = -80)] = 'SensitiveWordsError'
  /** 上传图片/文件/视频等数据超时 */
  ErrorCode[(ErrorCode.HighwayTimeout = -110)] = 'HighwayTimeout'
  /** 上传图片/文件/视频等数据遇到网络错误 */
  ErrorCode[(ErrorCode.HighwayNetworkError = -120)] = 'HighwayNetworkError'
  /** 没有上传通道 */
  ErrorCode[(ErrorCode.NoUploadChannel = -130)] = 'NoUploadChannel'
  /** 不支持的file类型(没有流) */
  ErrorCode[(ErrorCode.HighwayFileTypeError = -140)] = 'HighwayFileTypeError'
  /** 文件安全校验未通过不存在 */
  ErrorCode[(ErrorCode.UnsafeFile = -150)] = 'UnsafeFile'
  /** 离线(私聊)文件不存在 */
  ErrorCode[(ErrorCode.OfflineFileNotExists = -160)] = 'OfflineFileNotExists'
  /** 群文件不存在(无法转发) */
  ErrorCode[(ErrorCode.GroupFileNotExists = -170)] = 'GroupFileNotExists'
  /** 获取视频中的图片失败 */
  ErrorCode[(ErrorCode.FFmpegVideoThumbError = -210)] = 'FFmpegVideoThumbError'
  /** 音频转换失败 */
  ErrorCode[(ErrorCode.FFmpegPttTransError = -220)] = 'FFmpegPttTransError'
})((ErrorCode = errors.ErrorCode || (errors.ErrorCode = {})))
const ErrorMessage = {
  [ErrorCode.UserNotExists]: '查无此人',
  [ErrorCode.GroupNotJoined]: '未加入的群',
  [ErrorCode.MemberNotExists]: '幽灵群员',
  [ErrorCode.RiskMessageError]: '群消息发送失败，可能被风控',
  [ErrorCode.SensitiveWordsError]: '群消息发送失败，请检查消息内容',
  10: '消息过长',
  34: '消息过长',
  120: '在该群被禁言',
  121: 'AT全体剩余次数不足'
}
function drop (code, message) {
  if (!message || !message.length) message = ErrorMessage[code]
  throw new core.ApiRejection(code, message)
}
errors.drop = drop
/** 登录时可能出现的错误，不在列的都属于未知错误，暂时无法解决 */
let LoginErrorCode
(function (LoginErrorCode) {
  /** 密码错误 */
  LoginErrorCode[(LoginErrorCode.WrongPassword = 1)] = 'WrongPassword'
  /** 账号被冻结 */
  LoginErrorCode[(LoginErrorCode.AccountFrozen = 40)] = 'AccountFrozen'
  /** 发短信太频繁 */
  LoginErrorCode[(LoginErrorCode.TooManySms = 162)] = 'TooManySms'
  /** 短信验证码错误 */
  LoginErrorCode[(LoginErrorCode.WrongSmsCode = 163)] = 'WrongSmsCode'
  /** 滑块ticket错误 */
  LoginErrorCode[(LoginErrorCode.WrongTicket = 237)] = 'WrongTicket'
})((LoginErrorCode = errors.LoginErrorCode || (errors.LoginErrorCode = {})))
