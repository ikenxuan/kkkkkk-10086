/* eslint-disable no-sequences */
/* eslint-disable no-var */
/* eslint-disable no-unused-expressions */
export default class VerifyFpManager {
  static gen_verify_fp () {
    let e = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')
    let t = e.length
    let n = new Date().getTime().toString(36)
    let r = []

      ; (r[8] = r[13] = r[18] = r[23] = '_'), (r[14] = '4')
    for (var o, i = 0; i < 36; i++) r[i] || ((o = 0 | (Math.random() * t)), (r[i] = e[i == 19 ? (3 & o) | 8 : o]))
    return 'verify_' + n + '_' + r.join('')
  }

  static gen_s_v_web_id () {
    return this.gen_verify_fp()
  }
}
