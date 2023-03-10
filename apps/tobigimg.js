import plugin from '../../../lib/plugins/plugin.js'
import ArkMsg from "../../kkkkkk-10086/model/ArkMsg.js"
export class example extends plugin {
    constructor () {
      super({
        name: '大图',
        dsc: '简单开发示例',
        /* oicq文档：https://oicqjs.github.io/oicq/#events */
        event: 'message',
        priority: 50,
        rule: [
          {
            reg: '^7$',
            fnc: 'douy'
          }
  ]})}
  async douy(e) {
    let tiktokimg = "https://p9-pc-sign.douyinpic.com/tos-cn-i-0813c001/05fec3e2d8044e2bae10bdbaac884465~tplv-dy-aweme-images:q75.webp?x-expires=1679583600&x-signature=zhd20dLYPOL8lwTx6BLIQOZVcrk%3D&from=3213915784&s=PackSourceEnum_AWEME_DETAIL&se=false&biz_tag=aweme_images&l=202303092310500922A0992AD3E4329236"
    let res = ArkMsg.ShareImage_JSON(tiktokimg)
    await this.e.reply(await ArkMsg.Share(JSON.stringify(res.data), e))
    console.log(res.data)
}}
