import plugin from '../../../lib/plugins/plugin.js'
import { segment } from "oicq";
import uploadRecord from '../model/uploadRecord.js';
const _path = process.cwd() + '/plugins/kkkkkk-10086/resources/语音盒'
//鸡
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
const ji2 = {
  "圣诞鸡2": "shengdanji",
  "还珠格格": "huanzhujiji",
  "鸡铃声": "jilingshen",
  "baby鸡": "babyji",
  "emo鸡": "emoji",
  "兰亭鸡序": "lantingjixu",
  "dance鸡": "danceji",
  "承诺鸡": "chengnuoji",
  "鸡鸡侠": "jijixia",
  "心墙鸡": "xinqiangji",
  "自由飞翔":"ziyoujixiang",
  "鸡祥三宝": "jixiangsanbao",
  "鸡的诱惑": "jideyouhuo",
  "泰罗奥特鸡": "tailuoaoteji",
  "鸡哥照常升起": "jigezhaochangshengqi",
  "好汉歌": "haojige",
  "幸福拍手歌": "xingfupaijige",
  "鸡保国": "jibaoguo",
  "世界杯主题曲": "shijiebeizhutiqu",
  "甩鸡歌": "shuaijige",
  "笼里鸡丝": "longlijisi",
  "终极猎手梦泪": "zhognjilieshoumengji",
  "是鸡": "shiji",
  "nobaby鸡": "nobabyji",
  "印度风": "yindufeng",
  "NBA代言曲": "nbadaiyanqu",
  "学鸡叫": "xuejijiao",
  "听只因的话": "tingzhiyindehua",
  "年代鸡": "niandaiji",
  "没有撤退可言": "meiyouchetuikeyan",
  "再见莫尼鸡": "zaijianmoniji",
  "斗地主": "doujizhu",
  "自由自在鸡": "ziyouzizaiji",
  "最伟大的作品": "zuiweidadezuopin",
  "圣安地列鸡": "shengandilieji",
  "恋爱循环": "lianaixunhuan",
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
  "倍儿爽": "jiershuang",
  "红颜如霜": "hongyanrushuang",
  "济公": "jigong",
  "凤舞九天": "fengwujiutian",
  "维也纳交响曲": "weiyenajiaoxiangqu",
  "鸡的传人": "jidechuanren",
  "爱情买卖": "aiqingmaimai",
  "流浪地球": "liulangdiqiu",
  "潮流坤坤": "chaoliu01",
  "潮流坤坤2": "chaoliu02",
  "潮流坤坤3": "chaoliu03",
  "官方MV": "officalmv",
  "one last kiss": "one last kiss",
  "鸡真没睡": "jzms",
  "鸡你太吵": "jntc",
  "精卫": "jingwei",
  "高启强巅峰曲": "kb",
  "铃芽之旅": "lyzl",
  "walk thrn kun": "walkthrnkun",
  "good time": "goodtime",
  "寄明月": "jmy"

}
//丁真
const dz2 = {
  "阿巴": "1",
  "阿妈": "2",
  "阿姐": "3",
  "木": "4",
  "怒目": "5",
  "阿可": "6",
  "波波": "7",
  "阿休": "8",
  "阿捏": "9",
  "阿夜": "10",
  "阿秀": "11",
  "那鸡": "12",
  "煞": "13",
  "妮码": "14",
  "拿瓦": "15",
  "秃发": "16",
  "炸": "17",
  "老阔": "18",
  "破": "19",
  "手": "20",
  "脚": "21",
  "肚子": "22",
  "拉巴": "23",
  "公巴": "24",
  /*"": "25",
  "": "26",
  "": "27",
  "": "28",*/
  "我": "29",
  "测": "30",
  "你们": "31",
  "码": "32",
  "当他需要一个鼓励": "33",
  "我会笑着说": "34",
  "来": "35",
  "我测你们码": "36",
  "没开口他们": "37",
  "会笑着对我": "38",
  "测不出来": "39",
  "你好我是顶真": "40",
  "雪豹闭嘴": "41",
  "你是讨口子": "42",
  "你太拽了": "43",
  "你像葫芦侠": "44",
  "你这辈子找": "45",
  "我跟你说": "46",
  "我必收拾你": "47",
  "我天不怕地": "48",
  "只怕阿妈": "49",
  "不能说藏话": "50",
  "好我知道了": "51",
  "在教我做": "52",
  "对": "53",
  "我是顶真": "54",
  "OK": "55",
  "等一下": "56",
  "我跟蛇": "57",
  "你好": "58",
  "你想不想抽": "59",
  "我觉得你需要": "60",
  "悦克5代": "61",
  "我要过肺": "62",
  "我还要回龙": "63",
  "扎西德勒": "64",
  "吉祥如意": "65",
  "秋蝶某": "66",
  "就是你好的": "67",
  "在山里": "68",
  "麻麻生": "69",
  "四川省": "70",
  /*"": "71",
  "": "72",
  "": "73",
  "": "74",*/
  "雪豹闭嘴": "75",
  "不要坏了我的好事": "76",
  "到时候回家": "77",
  "我让阿妈打": "78",
  "在山里我能": "79",
  "雪豹叫": "80",
  "芝士雪豹": "81",
  "舍利叫": "82",
  "芝士舍利": "83",
  "狐狸叫": "84",
  "芝士狐狸": "85",
  "土拨鼠叫": "86",
  "芝士土拨鼠  ": "87",
  "章子叫": "88",
  "芝士章子": "89",
  "绵阳叫": "90",
  "芝士绵阳": "91",
  // "": "92",
  "芝士": "93",
  "我测你们码": "94",
  // "": "95",
  "芝士": "96",
  "讨口子": "97",
  "芝士我的个": "98",
  "音乐": "99",
//}
//const dz2 = {
  "最长的测码": "100",
  "醉赤壁": "101",
  "维新派降调": "102",
  "偷电子烟": "103",
  "i got smoke": "104",
  "smoke boy": "105",
  "zood": "106",
}
//鸡汤
const jitang = {
  "啊哈哈": "啊哈哈",
  "鸡汤来了": "鸡汤来了",
  "菜都齐了": "菜都齐了",
  "怎么不吃": "怎么不吃",
  "嘿秀秀": "嘿秀秀",
  "开玩笑": "开玩笑",
  "趁热吃": "趁热吃",
  "不打扰": "不打扰",
  "我走了": "我走了",
  "呵呵呵": "呵呵呵",
  "鸡汤珍贵": "鸡汤珍贵",
  "同志们喝": "同志们喝",
  "我炊事员": "我炊事员",
  "不能喝": "不能喝",
  "嘿秀": "嘿秀",
  "这不对": "这不对",
  "谁要吓我": "谁要吓我",
  "你吓我？": "你吓我？",
  "啊？": "啊？",
  "行": "行",
  "我喝": "我喝",
  "喝": "喝",
  "喝汤多美": "喝汤多美",
  "哎呀～": "哎呀～",
  "不咸不淡": "不咸不淡",
  "味道真好": "味道真好",
  "看没事吧": "看没事吧",
  "嘿喝吧": "嘿喝吧",
  "趁热喝吧": "趁热喝吧",
  "你得带头": "你得带头",
  "你不喝": "你不喝",
  "他们不喝": "他们不喝",
  "看我干嘛": "看我干嘛",
  "喝喝呀": "喝喝呀",
  "快趁热喝": "快趁热喝",
  "趁热喝呀": "趁热喝呀",
  "他奶奶的": "他奶奶的",
  "干嘛不喝": "干嘛不喝",
  "喝喝啊": "喝喝啊",
  "不喝炸你": "不喝炸你",
  "都不敢喝": "都不敢喝",
  "都怕死": "都怕死",
  "我告诉你": "我告诉你",
  "不喝？": "不喝？",
  "别想活": "别想活",
  "大家知道": "大家知道",
  "我不演了": "我不演了",
  "我就是": "我就是",
  "重庆军统": "重庆军统",
  "日本双料": "日本双料",
  "高级特工": "高级特工",
  "代号": "代号",
  "穿山甲": "穿山甲",
  "鸡汤毒": "鸡汤毒",
  "是我放的": "是我放的",
  "这鸡汤": "这鸡汤",
  "我喝了": "我喝了",
  "我得死": "我得死",
  "你们不喝": "你们不喝",
  "别想活": "别想活",
  "龟爷先生": "龟爷先生",
  "地皇B下": "地皇B下",
  "我的任务": "我的任务",
  "完成了": "完成了",
  "哈哈": "哈哈",
  "哈哈2": "哈哈2",
  "奶奶的": "奶奶的",
  "玩阴的": "玩阴的",
  "那就来吧": "那就来吧",
}
//耀阳
const yy = {
  "汪汪": "汪汪",
  "什么声音": "什么声音",
  "突然一声": "突然一声",
  "搞乱了": "搞乱了",
  "不要叫了": "不要叫了",
  "汪": "汪",
  "别狗叫了": "别狗叫了",
  "大胆": "大胆",
  "狗叫什么": "狗叫什么",
  "砸键盘": "砸键盘",
  "砸了": "砸键盘",
  "载入史册": "载入史册",
  "心烦意乱": "心烦意乱",
  "嘿": "嘿",
  "键盘收不": "键盘收不",
  "马上到": "马上到",
  "挂A": "挂A",
  "摆头": "摆头",
  "葫芦gei": "葫芦gei",
  // "": "",
  "哇靠": "哇靠",
  "本座来也": "本座来也",
  "护驾": "护驾",
  "啊！": "啊！",
  "放我一马": "放我一马",
  "我是主播": "我是主播",
  "威慑": "威慑",
  "走位": "走位",
  "螺旋": "螺旋",
  "别": "别",
  "不要": "不要",
  "击飞": "击飞",
  "芜芜": "芜芜",
  "瓜皮": "瓜皮",
  "你以为": "你以为",
  "来搞我": "来搞我",
  "螺旋": "螺旋",
  "别在搞我": "别在搞我",
  "搞什么": "搞什么",
  "小试牛刀": "小试牛刀",
  "雕虫小技": "雕虫小技",
  "遁入虚空": "遁入虚空",
  "螺旋走位": "螺旋走位",
  "宫保鸡丁": "宫保鸡丁",
  "航空母舰": "航空母舰",
  "凤舞九天": "凤舞九天",
  "近身硬打": "近身硬打",
  "祸国殃民": "祸国殃民",
  "螺旋摆头": "螺旋摆头",
  "摆头走位": "摆头走位",
  "为非作歹": "为非作歹",
  "东星耀扬": "东星耀扬",
  "不再低调": "不再低调",
  "螃蟹步伐": "螃蟹步伐",
  "亚洲捆绑": "亚洲捆绑",
  "蜻蜓点水": "蜻蜓点水",
  "老树盘根": "老树盘根",
  "功亏一篑": "功亏一篑",
  "花海": "花海",
  "空城": "空城",
  "简单爱": "简单爱",
  "告白气球": "告白气球",
}
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

//鸡
const jireg = new RegExp(`^(${Object.keys(ji).join("|")})$`)
const jireg2 = new RegExp(`^(${Object.keys(ji2).join("|")})$`)
//丁真
//const dzreg = new RegExp(`^(${Object.keys(dz).join("|")})$`)
const dzreg2 = new RegExp(`^(${Object.keys(dz2).join("|")})$`)
//鸡汤
const jitangreg = new RegExp(`^(${Object.keys(jitang).join("|")})$`)
//耀阳
const yyreg = new RegExp(`^(${Object.keys(yy).join("|")})$`)
//神鹰
const syreg = new RegExp(`^(${Object.keys(sy).join("|")})$`)






export class example extends plugin {
  constructor() {
    super({
      name: '语音盒',
      event: 'message',
      priority: 200,
      rule: [
        //鸡
        {
          reg: jireg,
          fnc: 'jiji'
        },
        {
          reg: jireg2,
          fnc: 'jiji2'
        },
        //丁真
        /*{
          reg: dzreg,
          fnc: 'dz1'
        },*/
        {
          reg: dzreg2,
          fnc: 'dz2'
        },
        //鸡汤
        {
          reg: jitangreg,
          fnc: 'jitang'
        },
        //耀阳
        {
          reg: yyreg,
          fnc: 'yy'
        },
        //神鹰
        {
          reg: syreg,
          fnc: 'sy'
        },
//--------------------------------------------------------------------------------------------------------------------------------------------------------------        
        {
          reg: "^(丁真)|(dz)盒$",
          fnc: 'dzhelp'
        },
        {
          reg: "^鸡(音|乐)盒$",
          fnc: 'jihelp'
        },
        {
          reg: "^(鸡汤)|(jt)盒$",
          fnc: 'jitanghelp'
        },
        {
          reg: "^(耀阳)|(yy)盒$",
          fnc: 'yyhelp'
        },
        {
          reg: "^(神鹰)|(sy)盒$",
          fnc: 'syhelp'
        },
        {
          reg: "^语音盒$",
          fnc: 'help'
        }
      ]
    })
  } 

    /**
 * 制作转发消息
 * @param e oicq消息e
 * @param title 转发描述
 * @param msg 消息数组
 */
    async  makeForwardMsg (qq, title, msg = []) {
      let nickname = Bot.nickname
      if (this.e.isGroup) {
        let info = await Bot.getGroupMemberInfo(this.e.group_id, qq)
        nickname = info.card ?? info.nickname
      }
      let userInfo = {
        user_id: this.e.user_id,
        nickname: this.e.sender.card || this.e.user_id,
      }
    
      let forwardMsg = []
      msg.forEach(v => {
        forwardMsg.push({
          ...userInfo,
          message: v
        })
      })
    
      /** 制作转发内容 */
      if (this.e.isGroup) {
        forwardMsg = await this.e.group.makeForwardMsg(forwardMsg)
      } else {
        forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg)
      }
    
      /** 处理描述 */
      forwardMsg.data = forwardMsg.data
        .replace(/\n/g, '')
        .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
        .replace(/___+/, `<title color="#777777" size="26">${title}</title>`)
    
      return forwardMsg
    }
    async help(e) {
      let res = []
      res.push(Object.keys({...ji,...ji2}).join("、"))
      res.push(Object.keys(dz2).join("、"))
      res.push(Object.keys(jitang).join("、"))
      res.push(Object.keys(yy).join("、"))
      res.push(Object.keys(sy).join("、"))
      let data1 = await this.makeForwardMsg(e.user_id, "语音盒", res)
      await this.e.reply(data1)
    }
  //鸡--------------------------------------------------------------------------------------------------------------------------------------------------------------
  async jiji(e) {
    e.reply(await uploadRecord(`http://jilehe.125ks.cn/Voice/jlh/res/${encodeURIComponent(ji[e.msg])}.mp3`, 0, false))
  }
  async jiji2(e) {
    e.reply(await uploadRecord(`file:///${_path}/鸡音盒/${encodeURIComponent(ji2[e.msg])}.mp3`, 0, false))
  }
  async jihelp(e) {
    let res = []
    res.push(Object.keys({...ji,...ji2}).join("、"))
    await this.e.reply(await this.makeForwardMsg(e.user_id, "鸡乐盒", res))
  }
  //丁真--------------------------------------------------------------------------------------------------------------------------------------------------------------
  /*async dz(e) {
    e.reply(await uploadRecord(`http://jilehe.125ks.cn/Voice/dzh/res/${encodeURIComponent(dz[e.msg])}.mp3`, 0, false))
  }*/
  async dz2(e) {
    e.reply(await uploadRecord(`file:///${_path}/丁真盒/${encodeURIComponent(dz2[e.msg])}.mp3`, 0, false))
  }
  async dzhelp(e) {
    let res = []
    res.push(Object.keys(dz2).join("、"))
    await this.e.reply(await this.makeForwardMsg(e.user_id, "丁真盒", res))
  }
  //鸡汤--------------------------------------------------------------------------------------------------------------------------------------------------------------
  async jitang(e) {
    e.reply(await uploadRecord(`http://jilehe.125ks.cn/Voice/jth/res/${encodeURIComponent(jitang[e.msg])}.mp3`, 0, false))
  }
  async jitanghelp(e) {
    let res = []
    res.push(Object.keys(jitang).join("、"))
    await this.e.reply(await this.makeForwardMsg(e.user_id, "鸡汤盒", res))
  }
  //耀阳--------------------------------------------------------------------------------------------------------------------------------------------------------------
  async yy(e) {
    e.reply(await uploadRecord(`http://jilehe.125ks.cn/Voice/yyh/res/${encodeURIComponent(yy[e.msg])}.mp3`, 0, false))
  }
  async yyhelp(e) {
    let res = []
    res.push(Object.keys(yy).join("、"))
    await this.e.reply(await this.makeForwardMsg(e.user_id, "耀阳盒", res))
  }
  //神鹰--------------------------------------------------------------------------------------------------------------------------------------------------------------
  async sy(e) {
    e.reply(await uploadRecord(`http://jilehe.125ks.cn/Voice/syh/res/${encodeURIComponent(sy[e.msg])}.mp3`, 0, false))
  }
  async syhelp(e) {
    let res = []
    res.push(Object.keys(sy).join("、"))
    await this.e.reply(await this.makeForwardMsg(e.user_id, "神鹰盒", res))
  }
}

