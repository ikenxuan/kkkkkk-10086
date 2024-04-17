import { base, BiLiBiLiAPI } from '../common.js'
import { checkuser } from './cookie.js'
import { wbi_sign } from './sign/wbi.js'

export default class bilidata extends base {
  constructor(type) {
    super()
    this.type = type
    this.headers['Referer'] = 'https://api.bilibili.com/'
    this.headers['Cookie'] = this.Config.bilibilick
  }

  async GetData(data) {
    let result
    switch (this.type) {
      case 'bilibilivideo':
        const INFODATA = await this.GlobalGetData({ url: await BiLiBiLiAPI.INFO(data.id) })
        const BASEURL = await BiLiBiLiAPI.VIDEO(INFODATA.data.aid, INFODATA.data.cid)
        const SIGN = await checkuser(BASEURL)
        const DATA = await this.GlobalGetData({
          url: (await BiLiBiLiAPI.VIDEO(INFODATA.data.aid, INFODATA.data.cid)) + SIGN.QUERY,
          headers: this.headers,
        })

        const PARAM = await wbi_sign(await BiLiBiLiAPI.COMMENTS(1, INFODATA.data.aid))
        const COMMENTSDATA = await this.GlobalGetData({ url: (await BiLiBiLiAPI.COMMENTS(1, INFODATA.data.aid)) + PARAM, headers: this.headers })
        const EMOJIDATA = await this.GlobalGetData({ url: await BiLiBiLiAPI.EMOJI() })
        return { INFODATA, DATA, COMMENTSDATA, EMOJIDATA, STATUS: SIGN.TYPE, TYPE: 'bilibilivideo' }

      case 'COMMENTS':
        const aPARAM = await wbi_sign(await BiLiBiLiAPI.COMMENTS(1, INFODATA.data.aid))
        const aCOMMENTSDATA = await this.GlobalGetData({ url: (await BiLiBiLiAPI.COMMENTS(1, INFODATA.data.aid)) + aPARAM, headers: this.headers })
        return aCOMMENTSDATA

      case 'EMOJI':
        return await this.GlobalGetData({ url: await BiLiBiLiAPI.EMOJI() })

      case '申请二维码':
        return await this.GlobalGetData({ url: await BiLiBiLiAPI.申请二维码() })

      case '判断二维码状态':
        result = await new this.networks({
          url: await BiLiBiLiAPI.判断二维码状态(data),
          headers: this.headers,
        }).getHeadersAndData()
        return result

      case '检查是否需要刷新':
        result = await this.GlobalGetData({ url: await BiLiBiLiAPI.检查是否需要刷新(data), headers: this.headers })
        return result

      case 'refresh_csrf':
        result = await this.GlobalGetData({
          url: await BiLiBiLiAPI.refresh_csrf(data),
          headers: this.headers,
          type: 'text',
        })
        return result

      case '刷新Cookie':
        result = await this.GlobalGetData({
          url: await BiLiBiLiAPI.刷新Cookie(),
          method: 'POST',
          body: data,
          headers: this.headers,
        })
        return result

      case '确认更新':
        result = await this.GlobalGetData({
          url: await BiLiBiLiAPI.确认更新(),
          method: 'POST',
          body: data,
          headers: this.headers,
        })

      case 'bangumivideo':
        let isep
        if (data.id.startsWith('ss')) {
          data.id = data.id.replace('ss', '')
          isep = false
        } else if (data.id.startsWith('ep')) {
          data.id = data.id.replace('ep', '')
          isep = true
        }
        const QUERY = await checkuser(await BiLiBiLiAPI.bangumivideo(data.id, isep))
        const INFO = await this.GlobalGetData({
          url: await BiLiBiLiAPI.bangumivideo(data.id, isep),
          headers: this.headers,
        })
        result = { INFODATA: INFO, USER: QUERY, TYPE: 'bangumivideo' }
        return result
    }
  }

  async GlobalGetData(options) {
    let result = await new this.networks(options).getData()
    return result
  }
}
