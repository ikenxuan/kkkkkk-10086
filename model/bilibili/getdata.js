import { base, BiLiBiLiAPI, networks } from '../common.js'
import { checkuser } from './cookie.js'

export default class bilidata extends base {
  constructor() {
    super()
    this.headers['Referer'] = 'https://api.bilibili.com/'
    this.headers['Cookie'] = this.Config.bilibilick
  }

  async GetData(bvid) {
    const INFODATA = await new networks({ url: await BiLiBiLiAPI.INFO(bvid) }).getData()
    const BASEURL = await BiLiBiLiAPI.VIDEO(INFODATA.data.aid, INFODATA.data.cid)
    const SIGN = await checkuser(BASEURL)
    const DATA = await new networks({ url: (await BiLiBiLiAPI.VIDEO(INFODATA.data.aid, INFODATA.data.cid)) + SIGN.QUERY, headers: this.headers }).getData()
    return { INFODATA, DATA, TYPE: SIGN.TYPE }
  }
}
