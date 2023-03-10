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
    /*let json = {
        "actionData": "",
        "actionData_A" :"",
        "app": "com.tencent.imagetextbot",
        "appID": "",
        "config": {
            "ctime": 0,
            "menuMode": 0,
            "showSender": 0,
            "token": 0,
            "type": "normal"
        },
        "desc": "",
        "extra": {},
        "meta": {
            "robot": {
                "cover": "",
                "jump_url": "",
                "subtitle": "",
                "title":{
                    "qq":0,
                    "type":"at"
                    }
            }
        },
        "prompt": '',
        "sourceAd":"",
        "sourceName":"",
        "sourceUrl":"",
        "text":"",
        "ver":"1.0.0.11",
        "view":"index"
    }*/
    let tiktokimg = "https://p9-pc-sign.douyinpic.com/tos-cn-i-0813c001/05fec3e2d8044e2bae10bdbaac884465~tplv-dy-aweme-images:q75.webp?x-expires=1679583600&x-signature=zhd20dLYPOL8lwTx6BLIQOZVcrk%3D&from=3213915784&s=PackSourceEnum_AWEME_DETAIL&se=false&biz_tag=aweme_images&l=202303092310500922A0992AD3E4329236"
    //json.meta.robot.cover = tiktokimg;
    let res = ArkMsg.ShareImage_JSON(tiktokimg)
    await this.e.reply(await ArkMsg.Share(JSON.stringify(res.data), e))
    //console.log(json)
}}
