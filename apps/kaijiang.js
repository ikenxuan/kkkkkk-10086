import plugin from '../../../lib/plugins/plugin.js'
import { segment } from "oicq";
import { Config} from '../components/index.js'
import moment from 'moment';
let sum = 1; //这里记录总次数 也就是每天可查询次数接口分开算
// yyyy-MM-DD 默认当前年月日 改后面的时间就行
let dateTime='YYYY-MM-DD 00:00:00'; //这里定义时间刷新时间格式是 年-月-日 时:分:秒
let GayCD = {};
import fs from 'node:fs'
const xhz_path ='plugins/kkkkkk-10086/resources/鸽鸽的照片/'


export class sjs extends plugin {
  constructor () {
    super({
      /** 功能名称 */
      name: '随机类游戏',
      /** 功能描述 */
      dsc: '随机类游戏',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      /** 优先级，数字越小等级越高 */
      priority: 5000,
      rule: [
        {
          /** 命令正则匹配 */
          reg: '^#*开奖$',
          /** 执行方法 */
          fnc: 'cj'
        }
      ]
    })
  }

  async cj(e) {
	  // if(!Config.getConfig('set','pz')['jryq']) return this.reply('抽奖功能已关闭')
    if(e.isMaster){e.reply('你是主人没有CD')}
    else{
	  let qq =  e.user_id
    let now_time = new Date().getTime();
        let g = await redis.get("xs" + qq + ":g");
        g = parseInt(g);
        let transferTimeout = 60000
        if (now_time < g + transferTimeout) {
        e.reply(`每${transferTimeout / 1000 / 60}分钟游玩一次`);
        //存在CD。直接返回
        return;
        }
        await redis.set("xs" + qq + ":g", now_time);
      }
      let qq =  e.user_id
    for(let msg of e.message){
     
       if(msg.type =='at'){
           qq = msg.qq
           break
     }
    }
    
    if(qq == null){
        return true
    }
    
    var num = Math.random();
  num = Math.ceil(num * 10);
 var nums = num*0.10
 var numss = num + nums
 
 
 
 
 var num2 = Math.random();
  num2 = Math.ceil(num2 * 12);
  var numb =num2*0.08
  var numbb =num2+numb
   
  var num3 = Math.random();
   num3 = Math.ceil(num3 * 14);
  
  var num4 = Math.random();
   num4 = Math.ceil(num4 * 12.9);

   if(!Config.getConfig('set','pz')['dz']) {return false}
  let file = fs.readdirSync(xhz_path)
     let imgnum = Math.round(Math.random() * (file.length - 1))

if(numss > numbb){
	await e.reply("正在开奖中.....");
	
	 setTimeout(() => {
	  e.reply("摇号成功，三秒后开奖");
	},1000);
 let msg = ['恭喜抽中三等奖,送你一个哥哥', segment.image(xhz_path + file[imgnum])]
 setTimeout(() => {
  e.reply(msg);
 }, 3000);
}else if(numss < num3){
	await e.reply("正在开奖中.....");

	 setTimeout(() => {
	  e.reply("摇号成功，三秒后开奖");
	},1000);
 let msk = ['恭喜抽中二等奖,送你一张壁纸', segment.image('https://mirlkoi.ifast3.vipnps.vip/api.php?sort=top')]
 setTimeout(() => {
  e.reply(msk);
 }, 3000);
 }else if(num3 < num4){
	 await e.reply("正在开奖中.....");
	 
	  setTimeout(() => {
	   e.reply("摇号成功，三秒后开奖");
	 },1000);
	let msp = ['恭喜抽中特等奖晚安', segment.image('https://iw233.cn/API/Random.php')]
  setTimeout(() => {
    e.reply(msp);
  }, 3000);
	e.group.muteMember(qq,28800);
}else if(num4 < numbb){
	await e.reply("正在开奖中.....");
	
	 setTimeout(() => {
	  e.reply("摇号成功，三秒后开奖");
	},1000);
	let msk = ['恭喜抽中一等奖,涩图一张', segment.image('https://api.sdgou.cc/api/tao/')]
  setTimeout(() => {
    e.reply(msk);
  }, 3000);
}
  return true; //返回true 阻挡消息不再往下
  }

  } 