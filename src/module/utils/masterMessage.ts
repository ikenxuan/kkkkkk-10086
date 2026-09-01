/**
 * 推送出错时给主人的告警通道。
 *
 * 从 `Base.ts` 整段搬来，行为逐字保留。这两个函数跟 amagi 没有关系
 * （`sendMasterMessage` 只是恰好被 amagi 那层 Proxy 当作「没有事件对象时的唯一投递口」），
 * 所以先独立成一个模块，让 `Base.ts` 和 `amagiClient.ts` 都只是它的调用方。
 */

import type { PushlistConfig } from '@/types/config'
import cfg from '@/runtime/host/config'
import Config from './Config.js'
import Version from './Version.js'

/**
 * 统计每个平台使用最多的机器人 ID 和使用次数
 * @typedef {Object} PlatformBotStats
 * @property {string} botId 机器人 ID
 * @property {number} count 使用次数
 */

/**
 * 统计推送列表中每个平台使用最多的机器人
 * @param {import('./Config.js').PushlistConfig} pushList 推送列表配置
 * @returns {{douyin: PlatformBotStats, bilibili: PlatformBotStats}} 返回每个平台使用最多的机器人统计
 */
export const statBotId = (pushList: PushlistConfig): {
  douyin: { botId: string; count: number }
  bilibili: { botId: string; count: number }
} => {
  const platformBotCount = {
    douyin: new Map<string, number>(),
    bilibili: new Map<string, number>()
  }

  pushList.douyin?.forEach(item => {
    item.group_id.forEach(gid => {
      const botId = gid.split(':')[1] || ''
      platformBotCount.douyin.set(botId, (platformBotCount.douyin.get(botId) ?? 0) + 1)
    })
  })

  pushList.bilibili?.forEach(item => {
    item.group_id.forEach(gid => {
      const botId = gid.split(':')[1] || ''
      platformBotCount.bilibili.set(botId, (platformBotCount.bilibili.get(botId) ?? 0) + 1)
    })
  })

  let douyinMaxCount = 0
  let douyinMostFrequentBot = ''
  platformBotCount.douyin.forEach((count, botId) => {
    if (count > douyinMaxCount) {
      douyinMaxCount = count
      douyinMostFrequentBot = botId
    }
  })

  let biliMaxCount = 0
  let biliMostFrequentBot = ''
  platformBotCount.bilibili.forEach((count, botId) => {
    if (count > biliMaxCount) {
      biliMaxCount = count
      biliMostFrequentBot = botId
    }
  })

  return {
    douyin: {
      botId: douyinMostFrequentBot,
      count: douyinMaxCount
    },
    bilibili: {
      botId: biliMostFrequentBot,
      count: biliMaxCount
    }
  }
}

/**
 * 发送错误消息给主人
 * @param {'douyin'|'bilibili'} platform 平台名称
 * @param {*} img 错误图片，`Render()` 返回的消息段数组（渲染失败时是 false）
 */
export const sendMasterMessage = async (
  platform: 'douyin' | 'bilibili',
  img: unknown
): Promise<void> => {
  /**
   * 必须把图片段摊平进消息数组，不能整个塞进去。
   *
   * `Render()` 返回的是 `ImageMessage[]`，原来写成 `['文案', img]` 就成了
   * 「数组里套数组」，序列化出来是
   * `[{"type":"text",...},{"data":{"0":{"type":"image","file":"base64://..."}}}]` ——
   * 第二段没有 `type`、`data` 里还多一层数字键，适配器认不出这种段，
   * 于是主人只收到那行文案，图被吞掉（实测线上就是这个现象）。
   *
   * 渲染失败时 `Render()` 返回 false，此时只发文案，别把 false 当段发出去。
   */
  const segments: unknown[] = [
    '推送任务出错！请即时解决以消除警告',
    ...(Array.isArray(img) ? img : img ? [img] : [])
  ]
  if (segments.length === 1) {
    logger.warn('[Base] 推送错误卡片渲染失败，只发送文字告警')
  }

  if (Version.BotName === 'TRSS-Yunzai') {
    await Bot?.sendMasterMsg(segments as never)
    return
  }

  const botId = statBotId(Config.pushlist)
  const masterList = cfg.masterQQ || []
  const bot = Bot?.[botId[platform].botId]
  if (!bot) {
    // 原来这里静默失败：拿不到 bot 就什么都不发，也不打日志
    logger.warn(`[Base] 找不到推送机器人 ${botId[platform].botId}，${platform} 的推送错误告警未能发出`)
    return
  }
  for (const masterQQ of masterList) {
    await bot.pickFriend(masterQQ)?.sendMsg(segments as never)
  }
}
