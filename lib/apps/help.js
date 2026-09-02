import { Render } from '../module/utils/index.js';
import { buildHelpGroups } from '../module/help/content.js';
import { collectRuntimeReport } from '../module/utils/runtime-report.js';
import { checkYunzaiVersion } from '../module/utils/yunzaiVersion.js';
/**
 * 菜单结构与三条命令的分工照搬上游 `karin-plugin-kkk` 的
 * `packages/core/src/apps/help.ts`：`#kkk版本` 出的是 `other/runtime`
 * 运行环境诊断卡。本仓库原来把版本和更新日志合成一条规则、全渲染成更新日志，
 * 运行时诊断卡（路由和模板早就在仓库里）因此一直没有任何入口。
 *
 * `#kkk更新日志` 已挪到 `apps/update.ts`：它读的是插件目录 git 里的提交，
 * 和「更新」同一份数据来源，跟帮助页无关。
 *
 * 与上游的差异仅限基础设施：
 * - `karin.command()` -> Yunzai 的 `plugin` 类 + `rule` 表
 * - `config.master()` 判主人 -> Yunzai 的 `e.isMaster`
 * - `Render(e, path, params)` -> 本仓库是 `Render(path, params)`
 * - `#kkk更新` 与 `#kkk更新日志` 都在 `apps/update.ts`
 */
const buildMenuForRole = (role) => {
    const filterItems = (items = []) => items
        .filter(item => !item.roles || item.roles.includes(role))
        .map(({ title, description, icon }) => ({ title, description, icon }));
    return buildHelpGroups().map(group => {
        const items = filterItems(group.items);
        const subGroups = group.subGroups
            ?.map(sub => ({ title: sub.title, items: filterItems(sub.items) }))
            .filter(sub => sub.items.length > 0);
        return { title: group.title, items, subGroups };
    }).filter(group => group.items.length > 0 || (group.subGroups && group.subGroups.length > 0));
};
export class kkkHelp extends plugin {
    constructor() {
        super({
            name: 'kkk帮助',
            event: 'message',
            priority: 2000,
            rule: [
                {
                    reg: '^#?kkk帮助$',
                    fnc: 'help'
                },
                {
                    reg: '^#?kkk版本$',
                    fnc: 'version'
                }
            ]
        });
    }
    /** `#kkk版本`：运行环境诊断卡，宿主版本偏低时追加一张升级告警卡 */
    async version(e) {
        const img = await Render('other/runtime', collectRuntimeReport(e));
        await e.reply(img);
        // `other/version_warning` 模板从初始移植起就在仓库里、文案也改成了 Yunzai 版，
        // 但一直没有调用点。挂在 `#kkk版本` 上而不是启动时推给主人：这条命令本来就是
        // 「看运行环境」，用户主动问才回答，不会在每次重启时刷屏。
        const outdated = checkYunzaiVersion();
        if (outdated) {
            await e.reply(await Render('other/version_warning', {
                requireVersion: outdated.required,
                currentVersion: outdated.current
            }));
        }
        return true;
    }
    async help(e) {
        const role = e.isMaster ? 'master' : 'member';
        const menu = buildMenuForRole(role);
        // 契约里 list 必填。Help.tsx 目前只读 menu，但上游是把菜单摊平填进来的，
        // 这里照搬，免得模板哪天改回读 list 时又变成空的
        const list = menu.flatMap(group => [
            ...group.items.map(({ title, description }) => ({ title, description })),
            ...(group.subGroups?.flatMap(sub => sub.items.map(({ title, description }) => ({ title, description }))) ?? [])
        ]);
        const img = await Render('other/help', {
            title: 'KKK插件帮助页面',
            role,
            menu,
            list
        });
        await e.reply(img);
        return true;
    }
}
