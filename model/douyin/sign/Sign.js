import { base, networks } from '#modules'
import { MsToken } from './MsToken.js'
import * as xbogus from './X-Bogus.cjs'
import * as ac_signature from './ac_signature.cjs'

export default class sign extends base {
  Mstoken(length) {
    return MsToken(length)
  }

  XB(url) {
    return xbogus.sign(new URLSearchParams(new URL(url).search).toString(), this.headers['User-Agent'])
  }

  async signature(url) {
    return ac_signature.sign(
      url || 'https://www.douyin.com',
      this.headers['User-Agent'],
      /__ac_nonce=([^;])/.exec(
        await new networks({
          url: url || 'https://www.douyin.com',
          headers: {
            cookie: 'device_web_cpu_core=12; device_web_memory_size=8; architecture=amd64; IsDouyinActive=false',
            'User-Agent': this.headers['User-Agent'],
          },
        }).getHeaders(),
      )['set-cookie'],
    )[1]
  }
}

export const Sign = new sign()
