import { bilibiliDB, douyinDB } from '@/module/db/index'
import { Bilibilipush, getBilibiliID } from '@/module/platform/bilibili/index'
import { getBilibiliData } from '@/module/platform/bilibili/api'
import { getDouyinData } from '@/module/platform/douyin/api'
import { DouYinpush, getDouyinID } from '@/module/platform/douyin/index'
import { Config, wrapWithErrorHandler } from '@/module/utils/index'
import type { PluginRule, PluginTask } from 'trss-yunzai'
import type { BilibiliPushItem, DouyinPushItem } from '@/types/config'
import type { CommandEvent } from '@/types/message'
import type { Platform } from '@/types/platform'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * 取 amagi 响应外层的 `data`。
 *
 * 旧实现直接写 `data.data`，响应结构异常时会抛 TypeError 并冒泡到宿主的错误处理，
 * 这里沿用「取不到就抛」，不静默把 undefined 传给下游。
 */
const requireData = (response: unknown, label: string): unknown => {
  if (!isRecord(response)) throw new TypeError(`${label}返回结构异常`)
  return response.data
}

/** 按路径取值，任意一层缺失返回 undefined，等价于旧实现的可选链 */
const readPath = (value: unknown, path: string[]): unknown => {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

/** 读取指定路径上的非空字符串 */
const readString = (value: unknown, path: string[]): string | undefined => {
  const found = readPath(value, path)
  return typeof found === 'string' && found ? found : undefined
}

/**
 * 把配置里的推送权限收敛到宿主 `PluginRule` 声明的取值。
 *
 * 宿主的 `filtPermission` 只特判 master / owner / admin，其余取值——包括锅巴面板提供的
 * `group.owner`、`group.admin`，以及配置缺失时的 undefined——都会走完全部判断直接放行，
 * 与 `all` 完全等价，因此这里统一成 `all`，行为与迁移前一致。
 */
const asRulePermission = (value: string | undefined): PluginRule['permission'] => {
  if (value === 'master' || value === 'owner' || value === 'admin') return value
  return 'all'
}

/** 取推送条目里的群号（`群号:机器人账号` 只要前半段） */
const toGroupIds = (list: string[] | undefined): string[] => {
  return (list || [])
    .map(item => String(item).split(':')[0])
    .filter((groupId): groupId is string => Boolean(groupId))
}

export class kkkPush extends plugin {
  constructor () {
    super({
      name: 'kkkkkk-10086-推送功能',
      dsc: '推送',
      event: 'message',
      priority: Config.app.defaulttool ? -Infinity : Config.app.priority,
      rule: [
        { reg: /^#设置抖音推送/, fnc: 'setdyPush', permission: asRulePermission(Config.douyin.push?.permission) },
        { reg: /^#设置[bB]站推送/, fnc: 'setbiliPush', permission: asRulePermission(Config.bilibili.push?.permission) },
        { reg: /^#(抖音|[bB]站)(全部)?强制推送/, fnc: 'forcePush', permission: 'master' },
        { reg: /^#(抖音|[bB]站)推送列表$/, fnc: 'pushlist' },
        { reg: /^#kkk设置推送机器人/, fnc: 'changeBotID', permission: 'master' },
        { reg: /^#kkk推送全局忽略/, fnc: 'globalIgnore', permission: 'master' }
      ]
    })

    // `Config` 对 default_config 与用户配置只做浅合并，用户只要写了 `push:` 这一层就可能缺 cron。
    // 旧实现原样把 cron 交给宿主（缺失时任务注册不上），这里不补默认值，只对齐宿主声明里必填的 cron。
    const task: PluginTask[] = []
    if (Config.bilibili.push?.switch) {
      task.push({
        cron: Config.bilibili.push.cron as string,
        name: '哔哩哔哩更新推送',
        fnc: this.createPushTask('哔哩哔哩更新推送', 'bilibili', () => this.bilibiliPush()),
        log: Config.bilibili.push.log
      })
    }
    if (Config.douyin.push?.switch) {
      task.push({
        cron: Config.douyin.push.cron as string,
        name: '抖音更新推送',
        fnc: this.createPushTask('抖音更新推送', 'douyin', () => this.douyinPush()),
        log: Config.douyin.push.log
      })
    }
    this.task = task
  }

  /**
   * 把定时推送包进 ErrorHandler。
   *
   * 定时任务没有触发事件，以前是把 `fnc` 直接交给宿主调度器的，于是整条链路都跑在
   * `createLogContext()` 之外：AsyncLocalStorage 里没有 store，`appendLog` 全部丢弃，
   * 推送出错时生成的错误卡片「执行日志」区永远是空的。
   * 包一层之后日志能采到，报错也会以卡片形式发给主人，而不是只在宿主控制台留一行。
   * （`testPush.ts` 里的测试推送本来就是这么包的，定时推送没包属于漏网。）
   */
  private createPushTask (
    businessName: string,
    platform: Platform,
    fn: () => Promise<boolean>
  ): () => Promise<void> {
    const handler = wrapWithErrorHandler(fn, { businessName, platform })
    return async () => { await handler(undefined) }
  }

  /**
   * 抖音推送方法
   * 这是一个异步方法，用于执行抖音推送操作
   */
  async douyinPush (): Promise<boolean> {
    // 创建DouYinpush实例并执行action方法
    await new DouYinpush().action()
    return true
  }

  /**
   * 执行B站推送功能的方法
   * 这是一个异步方法，用于调用B站推送类的action方法
   */
  async bilibiliPush (): Promise<boolean> {
    await new Bilibilipush().action()  // 创建B站推送实例并执行action方法
    return true
  }

  /**
   * 强制推送方法，根据消息内容判断并执行相应的推送操作
   * @param e 包含消息信息的对象
   */
  async forcePush (e: CommandEvent): Promise<boolean> {
    if (e.msg.includes('抖音')) {
      await new DouYinpush().action()
      return true
    } else if (/[bB]站/.test(e.msg)) {
      await new Bilibilipush().action()
      return true
    }
    return true
  }

  /**
   * 设置抖音推送功能的方法
   * @param e 事件对象，包含消息相关信息
   */
  async setdyPush (e: CommandEvent): Promise<boolean> {
    const query = e.msg.replace(/^#设置抖音推送/, '').trim()
    if (query === '开启' || query === '关闭') {
      const enable = query === '开启'
      Config.modify('douyin', 'push.switch', enable)
      await e.reply!(`抖音推送已${enable ? '开启' : '关闭'}，重启后生效`)
      return true
    }

    // 如果是私聊消息，直接返回true
    if (e.isPrivate) return true
    // `?? undefined` 只把 null 换成 undefined：getDouyinData 的 normalizeArgs 对两者都走
    // 「arg1 不是 cookie」分支，运行时行为与迁移前完全一致
    const data = await getDouyinData('搜索数据', Config.cookies.douyin ?? undefined, { query, typeMode: 'strict' })
    await new DouYinpush(e).setting(
      requireData(data, '抖音搜索数据') as Parameters<DouYinpush['setting']>[0]
    )
    return true
  }

  /**
   * 设置B站推送的异步方法
   * @param e 包含消息信息的对象
   */
  async setbiliPush (e: CommandEvent): Promise<boolean> {
    const query = e.msg
      .replace(/^#设置[bB]站推送/, '')
      .replace(/^(?:[Uu][Ii][Dd]:)?/, '')
      .trim()

    if (query === '开启' || query === '关闭') {
      const enable = query === '开启'
      Config.modify('bilibili', 'push.switch', enable)
      await e.reply!(`B站推送已${enable ? '开启' : '关闭'}，重启后生效`)
      return true
    }

    // 如果是私信消息，直接返回true
    if (e.isPrivate) return true
    // 检查是否配置了B站Cookie，如果没有则提示用户配置
    const cookie = Config.cookies.bilibili
    if (!cookie) {
      // 旧实现把 `{ at: true }` 传在了 quote 位（宿主 reply 的第二参数是 quote，at 属于第三参数
      // data），而宿主只对 quote 做真假判断，因此这里等价地传 true：
      // 迁移前后都只是引用回复，都不会真的 at 用户。
      await e.reply!('\n请先配置B站Cookie', true)
      return true
    }
    // 使用正则表达式匹配消息格式，提取UID
    const match = /^(\d+)$/.exec(query)
    if (match && match[1]) {
      // 获取B站用户主页数据
      const data = await getBilibiliData('用户主页数据', cookie, { host_mid: Number(match[1]), typeMode: 'strict' })
      // getBilibiliData 的返回类型是 unknown：方法名是动态的，wrapper 无法回推具体响应类型。
      // 运行时结构由 '用户主页数据' 这个方法名保证，这里按 setting() 的形参类型收窄，
      // 避免在业务层重复声明 amagi 的响应结构。
      const profile = requireData(data, 'B站用户主页数据') as Parameters<Bilibilipush['setting']>[0]
      // 创建Bilibilipush实例并调用setting方法进行设置
      await new Bilibilipush(e).setting(profile)
    }
    return true
  }

  /**
   * 根据消息内容显示不同平台的推送列表
   * @param e 消息事件对象
   */
  async pushlist (e: CommandEvent): Promise<boolean> {
    // 根据消息内容判断显示哪个平台的推送列表
    const platform = e.msg.includes('抖音') ? 'douyin' : 'bilibili'
    if (platform === 'douyin') {
      // 如果是抖音平台，则创建DouYinpush实例并渲染推送列表
      await new DouYinpush(e).renderPushList()
    } else {
      // 如果是哔哩哔哩平台，则创建Bilibilipush实例并渲染推送列表
      await new Bilibilipush(e).renderPushList()
    }
    return true
  }

  /**
   * 更改推送机器人ID的方法
   * @param e 事件对象，包含消息等信息
   */
  async changeBotID (e: CommandEvent): Promise<boolean> {
    // 定义匹配命令的正则表达式，用于识别"#kkk设置推送机器人"开头的消息
    const command = /^#kkk设置推送机器人/
    // 从消息中提取新的机器人ID，移除命令部分
    const newBotId = e.msg.replace(command, '')

    /** `群号:机器人账号` → `群号:新机器人账号` */
    const withNewBot = (groupId: string): string => {
      const [group_id] = groupId.split(':')
      return `${group_id}:${newBotId}`
    }

    // 更改推送列表机器人ID
    const updateGroupIds = <T extends DouyinPushItem | BilibiliPushItem>(list: T[] | null | undefined): T[] => {
      // 检查列表是否为空或未定义
      if (!list || !Array.isArray(list) || list.length === 0) {
        return []
      }

      return list.map(item => ({
        ...item,
        group_id: item.group_id ? item.group_id.map(withNewBot) : []
      }))
    }

    // 更新配置，提供默认空数组
    Config.modify('pushlist', 'douyin', updateGroupIds(Config.pushlist.douyin || []))
    Config.modify('pushlist', 'bilibili', updateGroupIds(Config.pushlist.bilibili || []))

    await e.reply!(`推送机器人已修改为${newBotId}`)
    return true
  }

  async globalIgnore (e: CommandEvent): Promise<boolean> {
    const url = e.msg.replace(/^#kkk推送全局忽略/, '').trim().match(/https?:\/\/[^\s]+/i)?.[0]
    if (!url) {
      await e.reply!('请提供要忽略的抖音作品或B站动态链接')
      return true
    }

    if (/(douyin|iesdouyin)\.com/.test(url)) return await this.ignoreDouyinWork(e, url)
    if (/bilibili\.com/.test(url)) return await this.ignoreBilibiliDynamic(e, url)

    await e.reply!('暂不支持该平台链接')
    return true
  }

  async ignoreDouyinWork (e: CommandEvent, url: string): Promise<boolean> {
    const idData = await getDouyinID(url, false)
    if (!idData?.aweme_id) {
      await e.reply!('无法解析该抖音作品链接')
      return true
    }

    const workInfo = await getDouyinData('聚合解析', Config.cookies.douyin || '', { aweme_id: idData.aweme_id, typeMode: 'strict' })
    const aweme = readPath(workInfo, ['data', 'aweme_detail']) || readPath(workInfo, ['data', 'data', 'aweme_detail'])
    const secUid = readString(aweme, ['author', 'sec_uid'])
    if (!secUid) {
      await e.reply!('无法获取该作品作者信息')
      return true
    }

    const subscribedItem = Config.pushlist.douyin?.find(item => item.sec_uid === secUid)
    if (!subscribedItem) {
      await e.reply!('该作品对应的博主未在推送订阅中，跳过')
      return true
    }

    const groupIds = toGroupIds(subscribedItem.group_id)
    for (const groupId of groupIds) {
      await douyinDB?.addAwemeCache(idData.aweme_id, secUid, groupId, 'post')
    }

    await e.reply!(`已忽略抖音作品 ${idData.aweme_id}，共 ${groupIds.length} 个群组标记为已处理`)
    return true
  }

  async ignoreBilibiliDynamic (e: CommandEvent, url: string): Promise<boolean> {
    const idData = await getBilibiliID(url, false)
    if (!idData?.dynamic_id) {
      await e.reply!('无法解析该B站动态链接')
      return true
    }

    const dynamicInfo = await getBilibiliData('动态详情数据', Config.cookies.bilibili || '', { dynamic_id: idData.dynamic_id, typeMode: 'strict' })
    const item = readPath(dynamicInfo, ['data', 'data', 'item']) || readPath(dynamicInfo, ['data', 'item'])
    const hostMid = Number(readPath(item, ['modules', 'module_author', 'mid']))
    if (!hostMid) {
      await e.reply!('无法获取该动态作者信息')
      return true
    }

    const subscribedItem = Config.pushlist.bilibili?.find(pushItem => Number(pushItem.host_mid) === hostMid)
    if (!subscribedItem) {
      await e.reply!('该动态对应的UP主未在推送订阅中，跳过')
      return true
    }

    const itemType = readPath(item, ['type'])
    const groupIds = toGroupIds(subscribedItem.group_id)
    for (const groupId of groupIds) {
      await bilibiliDB?.addDynamicCache(idData.dynamic_id, hostMid, groupId, typeof itemType === 'string' ? itemType : '')
    }

    await e.reply!(`已忽略B站动态 ${idData.dynamic_id}，共 ${groupIds.length} 个群组标记为已处理`)
    return true
  }
}
