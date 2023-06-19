import plugin from "../../../lib/plugins/plugin.js";
import { update } from '../../other/update.js'
import fs from 'fs'
import { exec, execSync } from "child_process";
import { promisify } from "util";
const Plugin_Name = 'kkkkkk-10086'
export class example extends plugin {
    constructor() {
        super({
            name: "kkkkkk-更新",
            event: "message",
            priority: 1000,
            rule: [
                {
                    reg: "^#?(kkkkkk|kkk|k)(插件)?(强制)?更新$",
                    fnc: "update_plugin",
                },
                {
                    reg: "^#?(kkkkkk|kkk|k)(插件)?更新日志$",
                    fnc: "update_log",
                },
                {
                    reg: "^#?(kkkkkk|kkk|k)(插件)?(下载|更新|升级)资源$",
                    fnc: "updateresources",
                },

            ],
        });
    }


    async update_plugin() {
        let Update_Plugin = new update();
        Update_Plugin.e = this.e;
        Update_Plugin.reply = this.reply;

        if (Update_Plugin.getPlugin((Plugin_Name))) {
            if (this.e.msg.includes('强制')) {
                execSync('git reset --hard', { cwd: `${process.cwd()}/plugins/${Plugin_Name}/` });
            }
            await Update_Plugin.runUpdate(Plugin_Name);
            if (Update_Plugin.isUp) {
                setTimeout(() => Update_Plugin.restart(), 2000)
            }
        }
        return true;
    }

    async update_log() {
        let Update_Plugin = new update();
        Update_Plugin.e = this.e;
        Update_Plugin.reply = this.reply;

        if (Update_Plugin.getPlugin(Plugin_Name)) {
            this.e.reply(await Update_Plugin.getLog(Plugin_Name));
        }
        return true;
    }

    //参考了atlas图鉴插件的代码
    async updateresources(e) {
        const _path = process.cwd()
        const repoUrl = 'https://gitee.com/ikenxuan/kkkkkk-10086-resources.git';
        const localPath = `${_path}/plugins/kkkkkk-10086/resources/kkkkkk-10086-resources`
        e.reply('Downloading')
        // 判断本地路径是否存在，如果不存在则执行 git clone 操作
        if (!fs.existsSync(localPath)) {
            await promisify(exec)(`git clone --depth=1 ${repoUrl} "${localPath}"`);
        }

        // 执行 git fetch 命令以获取远程分支变化
        await promisify(exec)(`git -C "${localPath}" fetch`);

        // 获取当前分支名称
        const { stdout: branchName } = await promisify(exec)(`git -C "${localPath}" symbolic-ref --short HEAD`);

        // 执行 git log 命令以获取最近一次提交的 SHA-1 值
        const { stdout: remoteSha } = await promisify(exec)(`git -C "${localPath}" rev-parse origin/${branchName}`);
        const { stdout: localSha } = await promisify(exec)(`git -C "${localPath}" rev-parse ${branchName}`);

        // 判断本地分支是否是最新的，如果不是则执行 git pull 操作
        if (remoteSha.trim() !== localSha.trim()) {
            await promisify(exec)(`git -C "${localPath}" pull`);
            e.reply(`从 ${repoUrl} 成功更新至 ${localPath}`);
        } else {
            e.reply('kkkkkk-10086-resources目前已经是最新了');
        }

    }

}