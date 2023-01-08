import { segment } from "oicq";
import fetch from "node-fetch";
import plugin from '../../../lib/plugins/plugin.js';
import common from'../../../lib/common/common.js'
import co from '../../../lib/common/common.js'
import fs from 'fs'
import YAML from 'yaml'
const settings = await YAML.parse(fs.readFileSync('./plugins/kkkkkk-10086/config/cfg.yaml','utf8'));
const settobig = await YAML.parse(fs.readFileSync('./plugins/kkkkkk-10086/config/tobig.yaml','utf8'));
export class St extends plugin {
    constructor() {
        super({
            name: "转大图设置",
            dsc: "更改转大图图设置",
            event: "message",
            priority: 5000,
            rule: [
                {
                    reg: '^#?(开启|关闭)转大图$',
                    fnc: 'settobig'
                }, {
                    reg: '^#?(开启|关闭)体力大图$',
                    fnc: 'setnote'
                },
            ],
        });
    }
    async settobig(e) {
        let set
        if (/开启转大图/.test(e.msg)) {
            set = true
        }else {
            set = false
        }
        settobig.tobigset = set
        fs.writeFileSync('./plugins/kkkkkk-10086/config/tobig.yaml',YAML.stringify(settobig),'utf8')
        e.reply('成功' + e.msg + ',已生效啦')
    }
    async setnote(e) {
        let set
        if (/开启体力大图/.test(e.msg)) {
            set = true
        }else {
            set = false
        }
        settobig.tobignote = set
        fs.writeFileSync('./plugins/kkkkkk-10086/config/tobig.yaml',YAML.stringify(settobig),'utf8')
        e.reply('成功' + e.msg + ',已生效啦')
    }

    
}