
import fetch from "node-fetch";
import lodash from 'lodash'
import moment from 'moment';
import cfg from '../../../lib/config/config.js'

export class gitupdate extends plugin{
    constructor(){
        super({
            name:'kkkkkk-10086',
            dsc:'检测仓库更新',
            event:'message',
            priority: 1234,
            rule:[//cv清凉图（
                {
                    reg:'^#?(订阅|删除)仓库$',
                    fnc:'add'
                },
                {
                    reg:'^#?(开启|关闭)仓库推送$',
                    fnc:'set'
                },
                {
                    reg:'^#?查看仓库列表$',
                    fnc:'check'
                },
                {
                    reg:'^#?检查仓库更新$',
                    fnc:'checkupdata'
                }
            ]
        })
        this.task = {
            cron: "0 0,15,30,45 8,9,10,11,12,13,14,15,16,17,18,19,20 * * ?",//定时每天早8点到晚8点，每15分钟检测一次
            name:'检测仓库推送',
            fnc: () => this.checkupdata(),
            log: false,//定时任务日志，true为显示日志可能会使日志变乱,默认值false
          };
    }
    async add (){
        if(!this.e.isMaster){
            return true
        }
        if(/订阅仓库/.test(this.e.msg)){
            this.setContext('addgit')
            await this.reply("请发送仓库地址")
        }
        if(/删除仓库/.test(this.e.msg)){
            this.setContext('delgit')
            await this.reply("请发送要删除的仓库地址")
        }
    }

    async delgit () {
        let key=JSON.parse(await redis.get('key'))
        if(key === null){
            key=[]
        }
        if(key.length===0){
            this.reply("暂时没有推送仓库呢~")
        }
        if(!this.e.msg.includes('gitee.com')&&!this.e.msg.includes('github.com')){
            this.reply("请输入正确的仓库地址")
            this.finish('delgit')
            return true
        }
        let list =this.e.msg.split('/')
        if(this.e.msg.includes('https'))
        {
            list.splice(0,2)
        }
        await redis.set('de',1)
        for(let i in key){
            if(key[i].infor.toString()===list.toString()){
                key.splice(i,1)
                key=await JSON.stringify(key)
                await redis.set('key',key)
                await redis.del('de')
            }
        }
        if(!await redis.get('de')){
            this.reply("成功删除,请输入【查看仓库列表】查看")
        }else{
            this.reply("删除失败了,请确认是否有这个仓库,或是否为正确的仓库地址")
        }
        this.finish('delgit')
    }
    async addgit () {
        let key=JSON.parse(await redis.get('key'))
        if(key === null){
            key=[]
        }
        if(!this.e.msg.includes('gitee.com')&&!this.e.msg.includes('github.com')){
            this.reply("请输入正确的仓库地址")
            this.finish('addgit')
            return true
        }
        let list =this.e.msg.split('/')
        if(this.e.msg.includes('https'))
        {
            list.splice(0,2)
        }
        for(let i in key ){
            if(key[i].infor.toString()===list.toString()){

                this.reply("已经添加过此仓库了")
                this.finish('addgit')
                return true
            }
        }
        key.push({infor:list})
        key=await JSON.stringify(key)
        if(this.e.msg.includes('gitee')){
            let url =`https://gitee.com/api/v5/repos/${list[1]}/${list[2]}/commits?page=1&per_page=10`
            let response =await fetch(url)
            const res =await response.json()
            try{
            await redis.set(`${list[0]}${list[1]}${list[2]}`,res[0].sha)
        }catch (e){
                this.reply("出错了,请确认你的仓库地址是否正确")
                this.finish('addgit')
                return true
            }
        }else{
            let url =`https://api.github.com/repos/${list[1]}/${list[2]}/commits?page=1&per_page=10`
            let response =await fetch(url)
            const res =await response.json()
            try{
            await redis.set(`${list[0]}${list[1]}${list[2]}`,res[0].sha)
        }catch (e){
            this.reply("出错了,请确认你的仓库地址是否正确")
            this.finish('addgit')
            return true
        }
        }
        await redis.set('key',key)
        this.reply('成功添加仓库地址,请使用【查看仓库列表】查看')
        this.finish('addgit')
        return true
    }
    async set (){
        if(!this.e.isMaster){
            return true
        }
        if(/开启仓库推送/.test(this.e.msg)){
            if(await redis.get('tuisong')){
                this.reply('已经开启推送了')
                return true
            }
            await redis.set('tuisong',1)
            await this.checkupsha()
            this.reply('已开启仓库动态推送')
            return true
        }
        if(/关闭仓库推送/.test(this.e.msg)){
            if(!await redis.get('tuisong')){
                this.reply('已经关闭推送了')
                return true
            }
            redis.del('tuisong')
            this.reply('已关闭仓库动态推送')
            return true
        }
    }
    async checkupsha () {
        let key=JSON.parse(await redis.get('key'))
        if(key === null){
            key=[]
        }
        lodash.forEach(key,async(data)=>{
                if(data.infor[0]==='github.com'){
                    let url =`https://api.github.com/repos/${data.infor[1]}/${data.infor[2]}/commits`
                    let response =await fetch(url)
                    const res =await response.json()
                    await redis.set(`${data.infor[0]}${data.infor[1]}${data.infor[2]}`,res[0].sha)
                     }else if(data.infor[0]==='gitee.com'){
                    let url =`https://gitee.com/api/v5/repos/${data.infor[1]}/${data.infor[2]}/commits`
                    let response =await fetch(url)
                    const res =await response.json()
                    await redis.set(`${data.infor[0]}${data.infor[1]}${data.infor[2]}`,res[0].sha)
                } 
        })
        return true
    }
    async checkupdata () {
        let key=JSON.parse(await redis.get('key'))
        if(key === null){
            key=[]
        }
        if(!await redis.get('tuisong')){
            return true
        }
        if(this.e){
            if(key.length===0){
                this.reply("暂时未添加推送仓库")
                return true
            }   
        }
        if(key.length===0){
            return true
        }
        let msg=[]
        for(let i in key){
            if(key[i].infor[0]==='gitee.com'){
                let url =`https://gitee.com/api/v5/repos/${key[i].infor[1]}/${key[i].infor[2]}/commits`
                let response =await fetch(url)
                const res =await response.json()
                for(let j in res){
                    let sha =await redis.get(`${key[i].infor[0]}${key[i].infor[1]}${key[i].infor[2]}`)
                    if(res[j].sha===sha){
                        for(j-1;j>0;j--){
                            msg.push(`【gitee.com】\n仓库【${key[i].infor[1]}/${key[i].infor[2]}】\n--------------
【${res[j-1].commit.author.name}】\n${res[j-1].commit.message}${moment(`${res[j-1].commit.author.date}`).format('YYYY-MM-DD HH:mm:ss')}`)
                        }
                        continue
                    }
                }
            }else if(key[i].infor[0]==='github.com'){
                let url =`https://api.github.com/repos/${key[i].infor[1]}/${key[i].infor[2]}/commits`
                let response =await fetch(url)
                const res =await response.json()
                for(let j in res){
                    let sha =await redis.get(`${key[i].infor[0]}${key[i].infor[1]}${key[i].infor[2]}`)
                    if(res[j].sha===sha){
                        for(j-1;j>0;j--){
                            msg.push(`【github.com】\n仓库【${key[i].infor[1]}/${key[i].infor[2]}】\n--------------
【${res[j-1].commit.author.name}】\n${res[j-1].commit.message}\n${moment(`${res[j-1].commit.author.date}`).format('YYYY-MM-DD HH:mm:ss')}`)
                        }
                        continue
                    }
                }
            }
        }
        if(this.e){
            if(msg.length){
                let title = ['有仓库更新了']
                let forward=await this.makeForwardMsg(Bot.uin,title,msg)
                this.checkupsha()
                this.reply(forward)
                return true
            }
            this.reply("暂时没有仓库更新")
            return true
        }else{
            if(msg.length){
                let title = ['有仓库更新了']
                let forward=await this.makeForwardMsg(Bot.uin,title,msg)
                this.checkupsha()
                Bot.pickUser(cfg.masterQQ[0]).sendMsg(forward)
                return true
            }
        }
    }
    async check () {
        let key=JSON.parse(await redis.get('key'))
        if(key === null){
            key=[]
        }
        if(key.length === 0 ){
            this.reply('暂时未添加推送仓库')
            return true
        }
        let msg= []
        let title = [`共有${key.length}个推送仓库`]
        lodash.forEach(key,(data)=>{
            msg.push(`【${data.infor[0]}】\n仓库【${data.infor[1]}/${data.infor[2]}】`)
        })
        let forward = await this.makeForwardMsg(Bot.uin,title,msg)
        this.reply(forward)
    }
    async makeForwardMsg(qq,title, msg) {
        let nickname = Bot.nickname
        let userInfo = {
          user_id: Bot.uin,
          nickname
        }
        let forwardMsg=[]
        for (let i in msg) {
            forwardMsg.push(
              {
                ...userInfo,
                message: msg[i]
              })
          }
          forwardMsg = await Bot.makeForwardMsg(forwardMsg)
        forwardMsg.data = forwardMsg.data
          .replace(/\n/g, '')
          .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
          .replace(/___+/, `<title color="#777777" size="26">${title}</title>`)
        return forwardMsg
      }
}