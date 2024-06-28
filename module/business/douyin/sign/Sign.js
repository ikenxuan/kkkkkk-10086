import { Networks } from '#components'
import { MsToken } from './MsToken.js'
import { AB } from './a_bougs.cjs'

const headers = {
  Accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
}

export default class Paramsign {
  Mstoken (length) {
    return MsToken(length)
  }

  AB (url) {
    return AB(new URLSearchParams(new URL(url).search).toString(), headers['User-Agent'])
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
