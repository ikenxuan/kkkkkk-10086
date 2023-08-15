import plugin from '../../../lib/plugins/plugin.js'
import fs from 'fs/promises'

let configPath = process.cwd() + '/plugins/kkkkkk-10086/config/config.json'

async function updateConfig(key, value, e) {
    const str = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(str)

    config[key] = value

    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    e.reply('设置成功！')
}

function getValue(msg) {
    if (msg.includes('开启')) return true
    if (msg.includes('关闭')) return false
}


export class admin extends plugin {

    constructor(e) {
        super({
            name: 'kkkkkk-10086-管理',
            dsc: 'admin',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#?(KKK|kkk|kkkkkk-10086)设置$',
                    fnc: 'set',
                    permission: 'master'
                },
                {
                    reg: '^#*(KKK|kkk|kkkkkk-10086)设置语音盒(开启|关闭)$',
                    fnc: 'voicebox',
                    permission: 'master'
                },
                {
                    reg: '^#*(KKK|kkk|kkkkkk-10086)设置(视频解析|解析)(开启|关闭)$',
                    fnc: 'tools',
                    permission: 'master'
                },
                {
                    reg: '^#*(KKK|kkk|kkkkkk-10086)设置(默认视频解析|默认解析)(开启|关闭)$',
                    fnc: 'defaulttool',
                    permission: 'master'
                },
                {
                    reg: '^#*(KKK|kkk|kkkkkk-10086)设置(评论解析|评论)(开启|关闭)$',
                    fnc: 'comments',
                    permission: 'master'
                },
                {
                    reg: '^#*(KKK|kkk|kkkkkk-10086)设置缓存删除(开启|关闭)$',
                    fnc: 'temp',
                    permission: 'master'
                }
            ]
        })
    }

    async set(e) {
        let text = []
        for(let i =0; i < this.rule.length; i++) {
            let reg = this.rule[i].reg
            text.push(reg)
        }
        e.reply(text)
    }
    async voicebox(e) {
        const value = getValue(e.msg)
        await updateConfig('voicebox', value, e)
    }

    async defaulttool(e) {
        const value = getValue(e.msg)
        await updateConfig('defaulttool', value, e)
    }

    async tools(e) {
        const value = getValue(e.msg)
        await updateConfig('videotool', value, e)
    }

    async comments(e) {
        const value = getValue(e.msg)
        await updateConfig('comments', value, e)
    }

    async temp(e) {
        const value = getValue(e.msg)
        await updateConfig('rmmp4', value, e)
    }

}