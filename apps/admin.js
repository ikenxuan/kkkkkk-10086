import plugin from '../../../lib/plugins/plugin.js'
import fs from 'fs/promises'

let configPath = process.cwd() + '/plugins/kkkkkk-10086/config/config.json'

export class admin extends plugin {
    constructor(e) {
        super({
            name: 'kkkkkk-10086-管理',
            dsc: 'admin',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#*(KKK|kkk|kkkkkk-10086)设置语音盒(开启|关闭)$',
                    fnc: 'voicebox'
                },
                {
                    reg: '^#*(KKK|kkk|kkkkkk-10086)设置(视频解析|解析)(开启|关闭)$',
                    fnc: 'tools'
                }
            ]
        })
    }

    async voicebox(e) {
        if (e.msg.includes('开启')) {
            const str = await fs.readFile(configPath, 'utf-8')
            const config = JSON.parse(str)
            config.voicebox = true
            await fs.writeFile(configPath, JSON.stringify(config, null, 2))
        } else if (e.msg.includes('关闭')) {
            const str = await fs.readFile(configPath, 'utf-8')
            const config = JSON.parse(str)
            config.voicebox = false
            await fs.writeFile(configPath, JSON.stringify(config, null, 2))
        }
    }

    async tools(e) {
        if (e.msg.includes('开启')) {
            const str = await fs.readFile(configPath, 'utf-8')
            const config = JSON.parse(str)
            config.videotool = true
            await fs.writeFile(configPath, JSON.stringify(config, null, 2))
        } else if (e.msg.includes('关闭')) {
            const str = await fs.readFile(configPath, 'utf-8')
            const config = JSON.parse(str)
            config.videotool = false
            await fs.writeFile(configPath, JSON.stringify(config, null, 2))
        }
    }

}
