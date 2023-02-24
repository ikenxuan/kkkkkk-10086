import plugin from '../../../lib/plugins/plugin.js'
import { segment } from "oicq";
import fs from 'node:fs'
const xhz_path ='plugins/kkkkkk-10086/resources/鸽鸽的照片/'


export class sjs extends plugin {
  constructor () {
    super({
      name: '随机类游戏',
      dsc: '随机类游戏',
      /** https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#*开奖$',
          fnc: 'cj'
        }
      ]
    })
  }

  async cj(e) {
    if (!e.isGroup) {
      return;
    }
    if (e.isMaster){}
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
	let msk = ['恭喜抽中一等奖,老婆一张', segment.image('https://app.zichen.zone/api/acg.php')]
  setTimeout(() => {
    e.reply(msk);
  }, 3000);
}
  return true; //返回true 阻挡消息不再往下
  }

  } 