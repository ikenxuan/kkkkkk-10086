import { segment } from "oicq";
import schedule from "node-schedule";
import moment from "moment";
import uploadRecord from "../../xiaofei-plugin/model/uploadRecord.js"
const _path = process.cwd() + '/plugins/kkkkkk-10086/resources/报时'
let Gruop  = [795874649,];


async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


//定时推送 定时区分 (秒 分 时 日 月 星期)
schedule.scheduleJob('0 0 0,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23 * * *', async()=>{ 
     let time = moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")
     let hours =(new Date(time).getHours());
     let path = `${_path}/resources/报时/${hours}.mp3`
    switch(hours){
        case 5:
            uploadRecord(path, 0, false)
            break;
         case 6:
            uploadRecord(path, 0, false)
            break;
         case 7:
            uploadRecord(path, 0, false)
            break;
         case 8:
            uploadRecord(path, 0, false)
            break;   
        
        case 9:
            uploadRecord(path, 0, false)
            break;   
        
        case 10:
            uploadRecord(path, 0, false)
            break;
            
        case 11:
            uploadRecord(path, 0, false)
            break;
        
        case 12:
            uploadRecord(path, 0, false)
            break;  
        
        case 13:
            uploadRecord(path, 0, false)
            break;  
            
        case 14:
            uploadRecord(path, 0, false)
            break; 
            
         case 15:
            uploadRecord(path, 0, false)
            break;
            
        case 16:
            uploadRecord(path, 0, false)
            break;   
            
        case 17:
            uploadRecord(path, 0, false)
            break;   
            
        case 18:
            uploadRecord(path, 0, false)
            break;   
            
        case 19:
            uploadRecord(path, 0, false)
            break;   
            
        case 20:
            uploadRecord(path, 0, false)
            break;   
            
        case 21:
            uploadRecord(path, 0, false)
            break;   
            
        case 22:
            uploadRecord(path, 0, false)
            break;   
            
        case 23:
            uploadRecord(path, 0, false)
            break;       
    }
  
  
	for (var key of Gruop) {
		//Bot.pickGroup(key * 1).sendMsg(msg);
	  	Bot.pickGroup(key * 1).sendMsg(segment.record(`file:///${path}`));
	  	
	  	await sleep(10000) 
	}
});



