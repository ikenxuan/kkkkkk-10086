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

  /*async getBilibiliDetail() {
    let url = `https://api.bilibili.com/x/relation/stat?vmid=401742377`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "cache-control": "no-cache",
        cookie:
          "buvid3=677DD7BA-C683-36BD-A749-226C4038A15C90212infoc; i-wanna-go-back=-1; _uuid=BC24CE7C-327C-EA21-1557-E2AD56B349F290616infoc; buvid4=D00106D3-4627-6AB5-08A4-17ACD359B52091194-022030518-zz+ybRUH3EO6AQfFzHmMAg%3D%3D; buvid_fp_plain=undefined; b_ut=5; CURRENT_BLACKGAP=0; fingerprint3=8c6bc1805046dddcb5b845e6c6cd78c3; blackside_state=0; rpdid=|(YlmJuJm||0J'uYRYR~lRYJ; LIVE_BUVID=AUTO6316464756111112; hit-dyn-v2=1; nostalgia_conf=-1; PVID=1; b_nut=100; fingerprint=b29b926764456b8a66beafee5d73ea1d; buvid_fp=b29b926764456b8a66beafee5d73ea1d; CURRENT_FNVAL=16",
        pragma: "no-cache",
        "sec-ch-ua":
          '"Microsoft Edge";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": 1,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.50",
      },
      redirect: "follow",
    });
    let data = await response.json();
    console.log(data)
    //return response;
  }*/

  //测试大图
  /*async douy(e) {
    let tiktokimg = "https://p9-pc-sign.douyinpic.com/tos-cn-i-0813c001/05fec3e2d8044e2bae10bdbaac884465~tplv-dy-aweme-images:q75.webp?x-expires=1679583600&x-signature=zhd20dLYPOL8lwTx6BLIQOZVcrk%3D&from=3213915784&s=PackSourceEnum_AWEME_DETAIL&se=false&biz_tag=aweme_images&l=202303092310500922A0992AD3E4329236"
    let res = ArkMsg.ShareImage_JSON(tiktokimg)
    await this.e.reply(await ArkMsg.Share(JSON.stringify(res.data), e))
    console.log(res.data)
  }*/
}
