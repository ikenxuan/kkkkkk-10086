import { Base, Networks } from '#components'
import { MsToken } from './MsToken.js'
import { AB } from './a_bougs.cjs'

export default class Paramsign extends Base {
  Mstoken (length) {
    return MsToken(length)
  }

  AB (url) {
    return AB(new URLSearchParams(new URL(url).search).toString(), this.headers['User-Agent'])
  }

  async signature (url) {
    // eslint-disable-next-line no-undef
    return ac_signature.sign(
      url || 'https://www.douyin.com',
      this.headers['User-Agent'],
      /__ac_nonce=([^;])/.exec(
        await new Networks({
          url: url || 'https://www.douyin.com',
          headers: {
            cookie: 'device_web_cpu_core=12; device_web_memory_size=8; architecture=amd64; IsDouyinActive=false',
            'User-Agent': this.headers['User-Agent']
          }
        }).getHeaders()
      )['set-cookie']
    )[1]
  }
}

export const Sign = new Paramsign()
