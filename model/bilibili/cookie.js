import { Config, BiLiBiLiAPI, networks } from '../common.js'
import { wbi_sign } from './sign/wbi.js'

export async function checkuser(BASEURL) {
  if (Config.bilibilick == '') return { QUERY: 'platform=html5', TYPE: '!isLogin' }
  const logininfo = await new networks({ url: await BiLiBiLiAPI.LOGIN_INFO(), headers: { Cookie: Config.bilibilick } }).getData()
  let sign = await wbi_sign(BASEURL)

  let qn = [6, 16, 32, 64, 74, 80, 112, 116, 120, 125, 126, 127]
  let isvip
  logininfo.data.vipStatus === 1 ? (isvip = true) : (isvip = false)
  if (isvip) {
    return { QUERY: `&fnval=16&fourk=1&${sign}`, TYPE: 'isLogin' }
  } else return { QUERY: `&qn=${qn[3]}&fnval=16`, TYPE: 'isLogin' }
}
