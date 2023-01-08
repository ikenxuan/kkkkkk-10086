import plugin from '../../../lib/plugins/plugin.js'
import { segment } from "oicq";
import uploadRecord from '../yenai-plugin/model/uploadRecord.js';
const sy = {
  "认不认识我": "1",
  "我是神鹰哥": "2",
  "敢不敢跟我": "3",
  "比划比划?": "4",
  "别装逼": "5",
  "我让你飞起": "6",
  "给脸不要?": "7",
  "你个狗": "8",
  "不给我交代": "9",
  "三天奏你": "10",
  "谁都干": "11",
  "噩梦缠绕": "12",
  "黑手": "13",
  "老比灯": "14",
  "跟狗一样": "15",
  "跟我比划": "16",
  "别装逼啊": "17",
  "大嘴巴子": "18",
  "呼si你": "19",
  "我是黑手哥": "20",
  "还有啊": "21",
  "听好了": "22",
  "听懂了吧？": "23",
  // "": "24",
  "要听我的": "25",
  "如果不听": "26",
  "装逼": "27",
  "逼踢飞": "28",
  "听懂了吗?": "29",
  "小逼崽子": "30",
  "那么自私": "31",
  "我操": "32",
  "比划黑手": "33",
  "黑涩会": "34",
  // "": "35",
  "一个咋地": "36",
  "给你脸了": "37",
  "我特么来了": "38",
  "你个逼样": "39",
  "草": "40",
  "你出来": "41",
}
const jireg = new RegExp(`^(${Object.keys(sy).join("|")})$`)
export class example extends plugin {
  constructor() {
    super({
      name: '神鹰盒',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: jireg,
          fnc: 'syh'
        },
        {
          reg: "^神鹰盒$",
          fnc: 'help'
        }
      ]

    })
  }


  async syh(e) {
    e.reply(await uploadRecord(`http://jilehe.125ks.cn/Voice/syh/res/${encodeURIComponent(sy[e.msg])}.mp3`, 0, false))
  }
  async help(e) {
    e.reply(Object.keys(sy).join("，"))
  }
}

