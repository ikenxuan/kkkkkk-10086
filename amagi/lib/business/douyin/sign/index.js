import crypto from 'crypto'
import a_bogus from './a_bogus.js'
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
}
export default class sign {
  /** 生成一个指定长度的随机字符串 */
  static Mstoken (length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const randomBytes = crypto.randomBytes(length)
    return Array.from(randomBytes, (byte) => characters[byte % characters.length]).join('')
  }
  /** a_bogus 签名算法 */
  static AB (url) {
    return a_bogus(url, headers['User-Agent'])
  }
  /** 生成一个唯一的验证字符串 */
  static VerifyFpManager () {
    const e = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')
    const t = e.length
    const n = new Date().getTime().toString(36)
    const r = [];
    (r[8] = r[13] = r[18] = r[23] = '_'), (r[14] = '4')
    for (var o, i = 0; i < 36; i++)
      r[i] || ((o = 0 | (Math.random() * t)), (r[i] = e[i == 19 ? (3 & o) | 8 : o]))
    return 'verify_' + n + '_' + r.join('')
  }
}
