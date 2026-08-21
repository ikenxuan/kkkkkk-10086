import { Render, Config } from '@/module/utils/index'
import { collectRuntimeReport } from '@/module/utils/runtime-report'
import { checkYunzaiVersion } from '@/module/utils/yunzaiVersion'
import type { CommandEvent } from '@/types/message'

/**
 * 帮助与版本两条命令。
 *
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

/** 帮助条目的可见角色 */
type HelpRole = 'member' | 'master'

/** 图标：图标名，或带颜色的对象（与模板契约的 MenuItem.icon 一致） */
type HelpIcon = string | { name: string, color?: string }

interface HelpItem {
  title: string
  description: string
  icon?: HelpIcon
  roles?: HelpRole[]
}

interface HelpGroup {
  title: string
  items: HelpItem[]
  subGroups?: Array<{ title: string, items: HelpItem[] }>
}

/** 帮助菜单只读取平台开关与推送权限，因此只收窄到这几个字段 */
interface HelpPlatformConfig {
  switch?: boolean
  douyintool?: boolean
  bilibilitool?: boolean
  kuaishoutool?: boolean
  push?: { permission?: string }
}

/** 拥有帮助条目的平台配置节 */
type HelpPlatform = 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'

const ConfigSafe = (name: HelpPlatform): HelpPlatformConfig | null => {
  try {
    return Config?.[name] || null
  } catch {
    return null
  }
}

const pushRole = (name: HelpPlatform): HelpRole[] => {
  const permission = ConfigSafe(name)?.push?.permission
  return permission === 'all' ? ['member', 'master'] : ['master']
}

/** 已开启解析的平台名，拼进「自动识别分享链接」那条的描述里 */
const enabledPlatforms = (): string => {
  const names: string[] = []
  if (ConfigSafe('douyin')?.switch ?? ConfigSafe('douyin')?.douyintool) names.push('抖音')
  if (ConfigSafe('bilibili')?.switch ?? ConfigSafe('bilibili')?.bilibilitool) names.push('哔哩哔哩')
  if (ConfigSafe('kuaishou')?.switch ?? ConfigSafe('kuaishou')?.kuaishoutool) names.push('快手')
  if (ConfigSafe('xiaohongshu')?.switch) names.push('小红书')
  return names.length > 0 ? `支持「${names.join('」「')}」` : '暂无可用平台'
}

const buildHelpGroups = (): HelpGroup[] => [
  {
    title: '常用功能',
    items: [
      {
        title: '自动识别分享链接进行解析',
        description: enabledPlatforms(),
        icon: 'ph:link-fill',
        roles: ['member', 'master']
      },
      {
        title: '「#解析」「#kkk解析」「#弹幕解析」',
        description: '在解析功能关闭的情况下，可对引用消息进行解析；弹幕解析仅适用于「抖音」「哔哩哔哩」',
        icon: 'ph:magic-wand-fill',
        roles: ['member', 'master']
      },
      {
        title: '#kkk解析统计',
        description: '查看当前群组的解析统计数据，包括各平台解析次数、使用用户数等',
        icon: 'ph:chart-bar-fill',
        roles: ['member', 'master']
      },
      {
        title: '#kkk全局解析统计',
        description: '查看全局解析统计数据，包括所有群组的解析情况、趋势分析和群组排行',
        icon: 'ph:chart-line-up-fill',
        roles: ['master']
      }
    ]
  },
  {
    title: '推送相关',
    items: [
      {
        title: '#抖音/B站推送列表',
        description: '查看当前群的订阅推送列表',
        icon: 'ph:list-checks-fill',
        roles: ['master']
      },
      {
        title: '#抖音/B站全部?强制推送',
        description: '全部强制推送：手动模拟一次定时任务；\n强制推送：只在触发群模拟一次定时任务；\n已推送过的不会再推送',
        icon: 'ph:paper-plane-right-fill',
        roles: ['master']
      },
      {
        title: '#设置抖音/B站推送 开启/关闭',
        description: '开启或关闭对应平台的推送任务，重启后生效',
        icon: 'ph:toggle-right-fill',
        roles: ['master']
      },
      {
        title: '#kkk推送全局忽略 + 链接',
        description: '对抖音作品或B站动态进行全局忽略，所有群组的推送标记为已处理',
        icon: 'ph:arrows-clockwise-fill',
        roles: ['master']
      }
    ],
    subGroups: [
      {
        title: '在群聊中再发送一次即可取消订阅',
        items: [
          {
            title: '#设置抖音推送 + 抖音号',
            description: '在群聊中发送以对该群订阅该抖音博主的作品更新',
            icon: 'ph:bell-fill',
            roles: pushRole('douyin')
          },
          {
            title: '#设置B站推送 + UP主UID',
            description: '在群聊中发送以对该群订阅该B站UP主的稿件/动态更新',
            icon: 'ph:bell-fill',
            roles: pushRole('bilibili')
          }
        ]
      }
    ]
  },
  {
    title: '设置相关',
    items: [
      {
        title: '#kkk设置推送机器人 + Bot ID',
        description: '一键更换推送机器人',
        icon: 'ph:robot-fill',
        roles: ['master']
      },
      {
        title: '#抖音登录',
        description: '使用抖音APP扫码登录获取 Cookies',
        icon: 'logos:tiktok-icon',
        roles: ['master']
      },
      {
        title: '#B站登录',
        description: '使用哔哩哔哩APP扫码登录获取 Cookies',
        icon: {
          name: 'streamline-ultimate:bilibili-logo-bold',
          color: '#7fe1fa'
        },
        roles: ['master']
      },
      {
        title: '锅巴面板',
        description: '在锅巴插件管理中配置 kkkkkk-10086',
        icon: 'ph:sliders-horizontal-fill',
        roles: ['master']
      }
    ]
  },
  {
    title: '其他',
    items: [
      {
        title: '#kkk版本',
        description: '查看插件、宿主、Node.js、适配器与系统资源等运行环境诊断信息',
        icon: 'ph:monitor-fill',
        roles: ['member', 'master']
      },
      {
        title: '#kkk更新日志',
        description: '查看插件目录 git 里最近的提交记录',
        icon: 'ph:scroll-fill',
        roles: ['member', 'master']
      },
      {
        title: '「#kkk更新」「#kkk强制更新」',
        description: '拉取并安装插件更新',
        icon: 'ph:arrows-clockwise-fill',
        roles: ['master']
      }
    ]
  }
]

/** 按角色过滤后的菜单，`roles` 不再随数据出去 */
const buildMenuForRole = (role: HelpRole) => {
  const filterItems = (items: HelpItem[] = []) =>
    items
      .filter(item => !item.roles || item.roles.includes(role))
      .map(({ title, description, icon }) => ({ title, description, icon }))

  return buildHelpGroups().map(group => {
    const items = filterItems(group.items)
    const subGroups = group.subGroups
      ?.map(sub => ({ title: sub.title, items: filterItems(sub.items) }))
      .filter(sub => sub.items.length > 0)
    return { title: group.title, items, subGroups }
  }).filter(group => group.items.length > 0 || (group.subGroups && group.subGroups.length > 0))
}

export class kkkHelp extends plugin {
  constructor () {
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
    })
  }

  /** `#kkk版本`：运行环境诊断卡，宿主版本偏低时追加一张升级告警卡 */
  async version (e: CommandEvent): Promise<boolean> {
    const img = await Render('other/runtime', collectRuntimeReport(e))
    await e.reply!(img)

    // `other/version_warning` 模板从初始移植起就在仓库里、文案也改成了 Yunzai 版，
    // 但一直没有调用点。挂在 `#kkk版本` 上而不是启动时推给主人：这条命令本来就是
    // 「看运行环境」，用户主动问才回答，不会在每次重启时刷屏。
    const outdated = checkYunzaiVersion()
    if (outdated) {
      await e.reply!(await Render('other/version_warning', {
        requireVersion: outdated.required,
        currentVersion: outdated.current
      }))
    }
    return true
  }

  async help (e: CommandEvent): Promise<boolean> {
    const role: HelpRole = e.isMaster ? 'master' : 'member'
    const menu = buildMenuForRole(role)
    // 契约里 list 必填。Help.tsx 目前只读 menu，但上游是把菜单摊平填进来的，
    // 这里照搬，免得模板哪天改回读 list 时又变成空的
    const list = menu.flatMap(group => [
      ...group.items.map(({ title, description }) => ({ title, description })),
      ...(group.subGroups?.flatMap(sub => sub.items.map(({ title, description }) => ({ title, description }))) ?? [])
    ])

    const img = await Render('other/help', {
      title: 'KKK插件帮助页面',
      role,
      menu,
      list
    })
    await e.reply!(img)
    return true
  }
}
