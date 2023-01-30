import { segment } from "oicq"
import plugin from '../../../lib/plugins/plugin.js'
export class anzhuohuoquck extends plugin {
    constructor() {
        super({
            name: '修仙教程',
            dsc: '修仙教程帮助',
            event: 'message',
            priority: 5,
            rule: [
                {
                    reg: '^#*修仙*(小白|新手)*(教程|教学)$|这个*怎么修仙|怎么修仙',
                    fnc: 'xiuxianjiaocheng'
                }				
            ]
        })
    }

    async xiuxianjiaocheng(e) {
        let msg = [
            segment.at(e.sender.user_id),
			" 修仙新手教程：\n（较全）https://docs.qq.com/doc/DSUhqZWdpZXJuUndZ?&u=4bd0757f64094c48b02d7cfc4eaeb44b\n（简略）https://docs.qq.com/doc/DY2VseXlDS0J3U2dF",
        ]
        e.reply(msg);

        return true
    }
}