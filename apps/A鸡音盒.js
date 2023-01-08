import plugin from '../../../lib/plugins/plugin.js'
import { segment } from "oicq";
import uploadRecord from '../../yenai-plugin/model/uploadRecord.js';
const ji = {
  "鸡": "j",
  "你": "n",
  "太": "t",
  "美": "m",
  "唱": "唱",
  "跳": "跳",
  "rap": "rp",
  "篮球": "lq",
  "music": "mck",
  "笑死": "xs",
  "哇呵呵": "哇呵呵",
  "喜欢": "喜欢",
  "制作人": "qm",
  "大家好": "djh",
  "我是": "ws",
  "鲲鲲": "鲲鲲",
  "你干嘛": "ngm",
  "哈哈": "hh",
  "哎呦": "ay",
  "你好烦": "nhf",
  "开始吟唱": "jntm",
  "你干嘛哈哈哟": "ngmhhy",
  "哟哈哈嘛干你": "yhhmgn",
  "二手鸡": "esj",
  "rap鸡": "rup",
  "DJ鸡": "djj",
  "谢谢鸡": "xxj",
  "惊魂鸡": "jhj",
  "仙剑鸡": "xjj",
  "新年鸡": "xnj",
  "战斗鸡": "zdj",
  "桃花鸡": "thj",
  "某人鸡": "mrj",
  "江南鸡": "jnj",
  "尖叫鸡": "jjj",
  "欢喜鸡": "hxj",
  "耶耶鸡": "yyj",
  "鸡太美": "jtm",
  "大悲鸡": "大悲鸡",
  "果宝鸡": "果宝鸡",
  "狂放鸡": "狂放鸡",
  "起鲲了": "起鲲了",
  "青蛙鸡": "青蛙鸡",
  "三国鸡": "三国鸡",
  "小母鸡": "小母鸡",
  "新闻鸡": "新闻鸡",
  "印度鸡": "印度鸡",
  "各种鸡": "各种鸡",
  "卡点鸡": "卡点鸡",
  "听鸡话": "听鸡话",
  "祝福鸡": "祝福鸡",
  "好运鸡": "好运鸡",
  "春节鸡": "春节鸡",
  "圣诞鸡": "圣诞鸡",
}
const jilocal = {
  "圣诞鸡2": "shengdanji",
  "还珠鸡鸡": "huanzhujiji",
  "鸡铃声": "jilingshen",
  "baby鸡": "babyji",
  "emo鸡": "emoji",
  "兰亭鸡序": "lantingjixu",
  "dance鸡": "danceji",
  "承诺鸡": "chengnuoji",
  "鸡鸡侠": "jijixia",
  "心墙鸡": "xinqiangji",
  "自由鸡翔":"ziyoujixiang",
  "鸡祥三宝": "jixiangsanbao",
  "鸡的诱惑": "jideyouhuo",
  "泰罗奥特鸡": "tailuoaoteji",
  "鸡哥照常升起": "jigezhaochangshengqi",
  "好鸡歌": "haojige",
  "幸福拍鸡歌": "xingfupaijige",
  "鸡保国": "jibaoguo",
  "世界杯主题曲": "shijiebeizhutiqu",
  "甩鸡歌": "shuaijige",
  "笼里鸡丝": "longlijisi",
  "终极猎手梦鸡": "zhognjilieshoumengji",
  "是鸡": "shiji",
  "nobaby鸡": "nobabyji",
  "印度风": "yindufeng",
  "NBA代言曲": "nbadaiyanqu",
  "学鸡叫": "xuejijiao",
  "听只因的话": "tingzhiyindehua",
  "年代鸡": "niandaiji",
  "没有撤退可言": "meiyouchetuikeyan",
  "再见莫尼鸡": "zaijianmoniji",
  "斗鸡主": "doujizhu",
  "自由自在鸡": "ziyouzizaiji",
  "最伟大的作品": "zuiweidadezuopin",
  "圣安地列鸡": "shengandilieji",
  "恋爱循环": "lianaixunh",
  "铃儿响叮当": "lingerxiangdingdang",
  "我们的歌": "womendege",
  "老人与鸡": "laorenyuji",
  "霍元甲": "huoyuanjia",
  "白月光与朱砂痣": "baiyueguang",
  "等着鸡回来": "dengzhejihuilai",
  "我在人民广场吃着炸鸡": "renminguangchang",
  "star sky": "starsky",
  "鸡儿飞": "jierfei",
  "see you again": "seeyouagain",
  "女人": "nvren",
  "五五开鸡节": "wuwukaiheijie",
  "兔子舞": "tuziwu",
  "西游记": "xiyouji",
  "星辰大海": "xinchendahai",
  "轨迹": "guiji",
  "猪八戒撞天婚": "zhubajiezhuangtianhun",
  "家有儿女": "jiayouernv",
  "名侦探坤坤": "mingzhentankunkun",
  "你嘛的澎湖湾": "nimadepenghuwan",
  "告白": "gaobai",
  "春光灿烂猪八戒": "chunguangcanlanzhubajie",
  "喜羊羊与灰太狼": "xiyy",
  "忐忑": "tante",
  "一路生花": "yilushenghua",
  "以嘛之名": "yimazhiming",
  "圣斗士": "shengdoushi",
  "极乐净土": "jilejingtu",
  "花之舞": "huazhiwu",
  "最长的电影": "zuichangdedianying",
  "当": "dang",
  "轨迹": "siyiyangnanguo",
  "悲伤失落交响曲": "beishagnshiluojiaoxiangqu",
  "第七元素": "diqiyuansu",
  "鸡泡时间到": "jipaoshijiandao",
  "坤坤大战僵尸": "kunkundazhanjiangshi",
  "鸡儿爽": "jiershuang",
  "红颜如霜": "hongyanrushuang",
  "济公": "jigong",
  "凤舞九天": "fengwujiutian",
  "维也纳交响曲": "weiyenajiaoxiangqu",
  "鸡的传人": "jidechuanren",
  "爱情买卖": "aiqingmaimai",
  "潮流坤坤1": "chaoliu01",
  "潮流坤坤2": "chaoliu02",
  "潮流坤坤3": "chaoliu03",
  "官方MV": "officalmv",
}

const jireg = new RegExp(`^(${Object.keys(ji).join("|")})$`)
const jireg2 = new RegExp(`^(${Object.keys(jilocal).join("|")})$`)

export class example extends plugin {
  constructor() {
    super({
      name: '鸡音盒',
      event: 'message',
      priority: 200,
      rule: [
        {
          reg: jireg,
          fnc: 'jiji'
        },
        {
          reg: jireg2,
          fnc: 'jiji2'
        },
        {
          reg: "^鸡音盒$",
          fnc: 'help'
        }
      ]

    })
  }


  async jiji(e) {
    e.reply(await uploadRecord(`http://jilehe.125ks.cn/Voice/jlh/res/${encodeURIComponent(ji[e.msg])}.mp3`, 0, false))
  }
  async jiji2(e) {
    e.reply(await uploadRecord(`E:/Yunzai-Bot/plugins/kkkkkk-10086/resources/鸡音盒/${encodeURIComponent(jilocal[e.msg])}.mp3`, 0, false))
  }
  
  async help(e) {
    e.reply(Object.keys({...ji,...jilocal}).join("、"))
  }
}

