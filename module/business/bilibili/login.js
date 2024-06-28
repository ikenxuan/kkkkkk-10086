import { Config, Base, Sleep } from '#components'
import { bilidata as Bilidata } from '#bilibili'
import { segment } from '#lib'
import QRCode from 'qrcode'

export default class BiLogin extends Base {
  constructor(e = {}) {
    super()
    this.e = e
  }

  async Login () {
    /** 申请二维码 */
    const qrcodeurl = await new Bilidata('申请二维码').GetData()
    const qrimg = await QRCode.toDataURL(qrcodeurl.data.url)
    this.qrcode_key = qrcodeurl.data.qrcode_key
    await this.e.reply(
      '免责声明:\n您将通过扫码完成获取哔哩哔哩以及ck用于B站API接口请求数据。\n本Bot不会保存您的登录状态。\n我方仅提供视频解析及相关B站内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码 ~',
      { recallMsg: 180 }
    )
    await this.e.reply([segment.image(qrimg.split(';')[1].replace('base64,', 'base64://')), segment.at(this.e.user_id), '请扫码以完成获取'], { recallMsg: 180 })

    /** 判断二维码状态 */
    // let Execution86038 = -1
    let executed86090 = false
    let completedCase0 = false
    for (let i = 0; i < 33; i++) {
      const qrcodestatusdata = await new Bilidata('判断二维码状态').GetData(this.qrcode_key)
      switch (qrcodestatusdata.data.data.code) {
        case 0:
          console.log(qrcodestatusdata.data.data.refresh_token)
          Config.cookies.bilibili = qrcodestatusdata.headers['set-cookie']
          // Config.bilibilirefresh_token = qrcodestatusdata.data.data.refresh_token
          this.e.reply('登录成功！相关信息已保存至config.json', true)
          completedCase0 = true
          break
        case 86038:
          i === 17 && this.e.reply('二维码已失效', true)
          break
        case 86090:
          if (!executed86090) {
            this.e.reply('二维码已扫码，未确认', true)
            executed86090 = true
          } else {
            executed86090 = true
          }
          break
      }
      if (completedCase0) break
      await Sleep(5000)
    }
  }
}
