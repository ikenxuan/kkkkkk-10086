import plugin from '../../../lib/plugins/plugin.js'
import fs from 'fs'
import lodash from 'lodash'
import { render, Data } from '../components/index.js'

export class yunzai_c_v_help extends plugin {
    constructor() {
        super({
            name: '转大图帮助',
            event: 'message',
            priority: 1145,
            rule: [
                {
                    reg: '^#?(大图|转大图|卡片|kkk|kkkkkk|10086)(命令|帮助|菜单|help|说明|功能|指令|使用说明)$',
                    fnc: 'messages'
                }
            ]
        });
    }
    async messages() {return await help(this.e);}
}
async function help(e) {
    let custom = {}
    let help = {}
    let { diyCfg, sysCfg } = await Data.importCfg('help')
    custom = help
    let helpConfig = lodash.defaults(diyCfg.helpCfg || {}, custom.helpCfg, sysCfg.helpCfg)
    let helpList = diyCfg.helpList || custom.helpList || sysCfg.helpList
    let helpGroup = []
    lodash.forEach(helpList, (group) => {
        if (group.auth && group.auth === 'master' && !e.isMaster) {return true}
        lodash.forEach(group.list, (help) => {
            let icon = help.icon * 1
            if (!icon) {
                help.css = 'display:none'
            } else {
                let x = (icon - 1) % 10
                let y = (icon - x - 1) / 10
                help.css = `background-position:-${x * 50}px -${y * 50}px`
            }
        })
        helpGroup.push(group)
    })
    let bg = await rodom()
    let colCount = 3;
    return await render('help/index', {
        helpCfg: helpConfig,
        helpGroup,
        bg,
        colCount,
        element: 'default'
    }, {
        e,
        scale: 2.0
    })
}
const rodom = async function () {
    var image = fs.readdirSync(`./plugins/kkkkkk-10086/resources/help/theme/`);
    var list_img = [];
    for (let val of image) {
        list_img.push(val)
    }
    var theme = list_img.length == 1 ? list_img[0] : list_img[lodash.random(0, list_img.length - 1)];
    return theme;
}