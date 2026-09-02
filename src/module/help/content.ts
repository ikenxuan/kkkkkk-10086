/**
 * 帮助菜单的原始数据与它依赖的类型。
 *
 * 单独一个模块而不是留在 `apps/help.ts`：`module/loader` 要求 `apps/*.js`
 * **有且仅有一个**具名导出（那个 plugin 构造函数），多一个就整文件拒载。
 * 而 `buildHelpGroups` 必须被 `tests/unit/help-menu.test.ts` 引到——`roles`
 * 在 `buildMenuForRole` 里被有意摘掉，走渲染那条路验不到它，漏写就会把主人
 * 专属命令泄进普通成员的帮助页。两个要求只能靠搬出 `apps/` 同时满足。
 */
import { Config } from '@/module/utils/index'
/** 帮助条目的可见角色 */
export type HelpRole = 'member' | 'master'

/** 图标：图标名，或带颜色的对象（与模板契约的 MenuItem.icon 一致） */
type HelpIcon = string | { name: string, color?: string }

export interface HelpItem {
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

/**
 * 菜单的原始数据（未按角色过滤）。
 *
 * 导出只为了让 `tests/unit/help-menu.test.ts` 能验字段齐全 —— 特别是 `roles`：
 * 它在 `buildMenuForRole` 里被有意摘掉，所以走渲染那条路（`kkkHelp.help()` +
 * 替身 Render）**看不到**它，而漏写 `roles` 恰好是这里最贵的错 —— 少了它
 * `filterItems` 会把条目发给所有人，主人专属命令就此泄进普通成员的帮助页。
 * 运行时仍然只有 `buildMenuForRole` 调它。
 */
export const buildHelpGroups = (): HelpGroup[] => [
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
        // 紧跟在解析条目之后：录直播走的是解析那条路（`tools.ts` 的 recordLive 复用
        // `findPlatformConfig` 判平台、再进 `runCoordinatedParse`），不是独立功能。
        title: '#kkk录直播 + 直播间链接',
        // 三个数都得跟着代码走，别在这里写字面量的来源：
        // - 平台取自 `LiveRecordPlatform`（common/types.ts），也是 recordLive 里
        //   `handler !== 'douyin' && handler !== 'bilibili'` 那道闸放行的两家
        // - 10 分钟是 `LIVE_RECORD_MAX_DURATION_MS`（= 协调器预算 720s - 上传余量 120s）
        // - 「录完才上传」是实现的硬约束：ffmpeg 靠 `-t` 收口，收口前没有文件可发
        description: '支持「抖音」「哔哩哔哩」的直播间链接；单次最长录 10 分钟，录完整段后作为文件上传，期间本群其它解析都在排队',
        icon: 'ph:record-fill',
        // 与 `tools.ts` 里这条规则的 `permission` 一致（没有设，即不限主人）
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
