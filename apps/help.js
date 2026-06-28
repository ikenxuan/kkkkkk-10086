import { Render, Version, Config } from '../module/utils/index.js'
import fs from 'node:fs'

const buildHelpMenu = (role) => {
  const platformNames = []
  if (ConfigSafe('douyin')?.switch ?? ConfigSafe('douyin')?.douyintool) platformNames.push('抖音')
  if (ConfigSafe('bilibili')?.switch ?? ConfigSafe('bilibili')?.bilibilitool) platformNames.push('哔哩哔哩')
  if (ConfigSafe('kuaishou')?.switch ?? ConfigSafe('kuaishou')?.kuaishoutool) platformNames.push('快手')
  if (ConfigSafe('xiaohongshu')?.switch) platformNames.push('小红书')

  const groups = [
    {
      title: '常用功能',
      items: [
        { title: '自动识别分享链接进行解析', description: platformNames.length ? `支持「${platformNames.join('」「')}」` : '暂无可用平台', roles: ['member', 'master'] },
        { title: '「#解析」「#kkk解析」「#弹幕解析」', description: '在解析功能关闭时可对引用消息解析，弹幕解析适用于抖音与哔哩哔哩', roles: ['member', 'master'] },
        { title: '#kkk解析统计', description: '查看当前群组的解析统计数据', roles: ['member', 'master'] },
        { title: '#kkk全局解析统计', description: '查看全局解析统计、趋势和群组排行', roles: ['master'] }
      ]
    },
    {
      title: '推送相关',
      items: [
        { title: '#设置抖音推送 + 抖音号', description: '在群聊中订阅或取消订阅抖音博主', roles: pushRole('douyin') },
        { title: '#设置B站推送 + UP主UID', description: '在群聊中订阅或取消订阅 B 站 UP 主', roles: pushRole('bilibili') },
        { title: '#抖音/B站推送列表', description: '查看当前群的订阅推送列表', roles: ['master'] },
        { title: '#抖音/B站全部?强制推送', description: '手动模拟一次推送任务，已推送过的不会重复推送', roles: ['master'] },
        { title: '#设置抖音推送 开启/关闭', description: '开启或关闭抖音推送任务，重启后生效', roles: ['master'] },
        { title: '#设置B站推送 开启/关闭', description: '开启或关闭 B 站推送任务，重启后生效', roles: ['master'] },
        { title: '#kkk推送全局忽略 + 链接', description: '把指定作品或动态标记为已处理，避免继续推送', roles: ['master'] }
      ]
    },
    {
      title: '设置相关',
      items: [
        { title: '#kkk设置推送机器人 + Bot ID', description: '一键更换推送机器人', roles: ['master'] },
        { title: '#抖音登录', description: '使用抖音 APP 扫码登录获取 Cookies', roles: ['master'] },
        { title: '#B站登录', description: '使用哔哩哔哩 APP 扫码登录获取 Cookies', roles: ['master'] },
        { title: '锅巴面板', description: '在锅巴插件管理中配置 kkkkkk-10086', roles: ['master'] }
      ]
    },
    {
      title: '其他',
      items: [
        { title: '「#kkk版本」「#kkk更新日志」「#kkk更新」', description: '查看版本与更新日志', roles: ['member', 'master'] }
      ]
    }
  ]

  return groups.map(group => ({
    title: group.title,
    items: group.items.filter(item => item.roles.includes(role)).map(({ title, description }) => ({ title, description }))
  })).filter(group => group.items.length > 0)
}

const ConfigSafe = (name) => {
  try {
    return Config?.[name] || null
  } catch {
    return null
  }
}

const pushRole = (name) => {
  const permission = ConfigSafe(name)?.push?.permission
  return permission === 'all' ? ['member', 'master'] : ['master']
}

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
          reg: '^#?kkk(版本|更新日志|更新)$',
          fnc: 'version'
        }
      ]
    })
  }

  async version(e) {
    const changelogs = fs.readFileSync(Version.pluginPath + '/CHANGELOG.md', 'utf8')
    const img = await Render('other/changelog', {
      title: 'KKK 更新日志',
      markdown: changelogs,
      version: Version.version
    })
    await e.reply(img)
    return true
  }

  async help(e) {
    const role = e.isMaster ? 'master' : 'member'
    const img = await Render('other/help', {
      title: 'KKK插件帮助页面',
      role,
      menu: buildHelpMenu(role)
    })
    await e.reply(img)
    return true
  }
}
