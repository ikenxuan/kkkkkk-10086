import { networks } from '#modules'
import * as ac_signature from './ac_signature.cjs'

export async function dyck() {
  const data = {
    url: 'https://www.douyin.com',
    headers: {
      cookie: 'device_web_cpu_core=12; device_web_memory_size=8; architecture=amd64; IsDouyinActive=false',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  }
  const a = await new networks(data).getHeaders()
  const b = signature(data.url, data.headers['User-Agent'], /__ac_nonce=([^;]+)/.exec(a['set-cookie'])[1])
  console.log(a['set-cookie'] + '; __ac_signature=' + b)
  return a['set-cookie'] + '; __ac_signature=' + b
}
function signature(url, ua, ac_nonce) {
  return ac_signature.sign(url, ua, ac_nonce)
}
