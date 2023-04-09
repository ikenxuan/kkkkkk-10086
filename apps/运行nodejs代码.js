import {exec} from "child_process";
//import axios from "axios"
//想在jsrun部分使用库请在这里导入，例如import axios from "axios"

let pmState = true
let pmStateN=""
let outState = false
let outStateN=""

export class example extends plugin {
	constructor() {
		super({
			name: '指令运行工具',
			event: 'message',
			priority: 500,
			rule: [
			{
				reg: "^##(.*)",
				fnc: 'jsrun'
			},
			{
				reg: "^#*cmd(.*)",
				fnc: 'cmd'
			},
			{
				reg: '^#权限$',
				fnc: 'changePM',
				permission: 'master'
			},
			{
				reg: '^#编码$',
				fnc: 'changeOutput'
			}]
		})
	}
  
	async jsrun(e) {
		try {
			const content = e.message[0].text.split("##")[1]
			if (content === undefined) return
			if (content.includes('权限')||content.includes('编码')) return

			let res = await eval(content);
			const dataType = (res && res.data) || res;
			if (typeof dataType === 'string') return e.reply(dataType);
			if (dataType === undefined) return e.reply("程序无返回值");
			await e.reply(JSON.stringify(dataType, null, 4));
		} 
		catch(error) {
			await e.reply('错误：' + error.message)
			console.log(error)
		}
	}

	async cmd(e) {
		if (pmState) {
			if (!e.isMaster) {
				e.reply("你无权使用此插件。")
				return
			}
		}
		if (outState) {outStateN="utf-8"}else{outStateN="gbk"}
		
		const content = e.message[0].text.split("cmd")[1]
		const GBK = new TextDecoder("GBK")
		if (outState) {
			exec(content, {encoding: '',timeout:30000}, (err, stdout, stderr) => {
				if (err) {
					e.reply(String(GBK.decode(stderr)))
				} else {
					stdout = String(stdout)
					e.reply(`${outStateN}:\n`+stdout)
				}
			})
		} else {
			exec(content, {encoding: '',tiemout:30000}, (err, stdout, stderr) => {
				if (err) {
					e.reply(String(GBK.decode(stderr)))
				} else {
					stdout = String(GBK.decode(stdout))
					e.reply(`${outStateN}:\n`+stdout)
				}
			})
		}
	}
	
	async changePM(e) {
		pmState=!pmState
		if (pmState) {pmStateN="仅主人"}else{pmStateN="所有人"}
		await e.reply('插件使用权限已改为：'+pmStateN)
	}
	
	async changeOutput(e) {
		outState=!outState
		if (outState) {outStateN="utf-8"}else{outStateN="gbk"}
		await e.reply('输出格式已改为：'+outStateN)
	}
}