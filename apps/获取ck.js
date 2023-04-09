import plugin from '../../../lib/plugins/plugin.js'

//项目路径
// const _path = process.cwd() + '/plugins/genshin'

export class anzhuohuoquck extends plugin {
    constructor() {
        super({
            name: '安卓获取ck',
            dsc: '获取cookie帮助',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: '^#?安卓获取ck|安卓获取cookie|获取ck|获取cookie$',
                    fnc: 'anzhuogetckhelp'
                }
            ]
        })
    }

    async anzhuogetckhelp(e) {
        let msg = [
            segment.at(e.sender.user_id),
            "\n部分系统手机管家可能会报毒，这是正常的请放心安装，不会危害隐私安全",
            "\n1.请先下载app>[全服(包含国际服)获取Ck或Stoken]：链接: https://pan.baidu.com/s/13FpqZ03AO-JVpCGJ_aPo3Q?pwd=2023（安卓）",
            "\n2.登录完右上角复制好cookie后，请'私聊'发送给我，如无法临时与我聊天，请加好友发送（一定要私聊发送！）",
            "\nps:如果您是iOS/win用户，请使用'#cookie帮助'命令来获取帮助",
            //segment.image(`file:///${_path}/resources/logHelp/记录帮助.png`),
        ]
        e.reply(msg)
        return true
    }
}