import { Version, Config, logger } from '../utils/index.js'
import { Sequelize, DataTypes, Op } from 'sequelize'
import { join } from 'node:path'

/**
 * @typedef {import('../utils/Config.js').bilibiliPushItem} bilibiliPushItem
 */

/**
 * @typedef {import('../platform/bilibili/push.js').BilibiliPushItem} BilibiliPushItem
 */

// 创建数据库连接
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(Version.pluginPath, 'data', 'bilibili.db'),
  logging: false
})

// 定义模型
const Bot = sequelize.define('Bot', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    comment: '机器人ID'
  }
}, {
  timestamps: true,
  tableName: 'Bots'
})

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    comment: '群组ID'
  },
  botId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '所属机器人ID'
  }
}, {
  timestamps: true,
  tableName: 'Groups'
})

const BilibiliUser = sequelize.define('BilibiliUser', {
  host_mid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    comment: 'B站用户UID'
  },
  remark: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'B站用户昵称'
  },
  filterMode: {
    type: DataTypes.STRING,
    defaultValue: 'blacklist',
    comment: '过滤模式：黑名单或白名单'
  }
}, {
  timestamps: true,
  tableName: 'BilibiliUsers'
})

const GroupUserSubscription = sequelize.define('GroupUserSubscription', {
  groupId: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    comment: '群组ID'
  },
  host_mid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    comment: 'B站用户UID'
  }
}, {
  timestamps: true,
  tableName: 'GroupUserSubscriptions'
})

const DynamicCache = sequelize.define('DynamicCache', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '缓存ID'
  },
  dynamic_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '动态ID'
  },
  host_mid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'B站用户UID'
  },
  groupId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '群组ID'
  },
  dynamic_type: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '动态类型'
  }
}, {
  timestamps: true,
  tableName: 'DynamicCaches'
})

const FilterWord = sequelize.define('FilterWord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '过滤词ID'
  },
  host_mid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'B站用户UID'
  },
  word: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '过滤词'
  },
  bilibiliUserHostMid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'B站用户UID外键'
  }
}, {
  timestamps: true,
  tableName: 'FilterWords'
})

const FilterTag = sequelize.define('FilterTag', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '过滤标签ID'
  },
  host_mid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'B站用户UID'
  },
  tag: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '过滤标签'
  },
  bilibiliUserHostMid: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'B站用户UID外键'
  }
}, {
  timestamps: true,
  tableName: 'FilterTags'
})

// 定义关联关系
Bot.hasMany(Group, { foreignKey: 'botId' })
Group.belongsTo(Bot, { foreignKey: 'botId' })

Group.belongsToMany(BilibiliUser, {
  through: GroupUserSubscription,
  foreignKey: 'groupId',
  otherKey: 'host_mid'
})
BilibiliUser.belongsToMany(Group, {
  through: GroupUserSubscription,
  foreignKey: 'host_mid',
  otherKey: 'groupId'
})

BilibiliUser.hasMany(DynamicCache, { foreignKey: 'host_mid' })
DynamicCache.belongsTo(BilibiliUser, { foreignKey: 'host_mid' })

Group.hasMany(DynamicCache, { foreignKey: 'groupId' })
DynamicCache.belongsTo(Group, { foreignKey: 'groupId' })

BilibiliUser.hasMany(FilterWord, { foreignKey: 'bilibiliUserHostMid' })
FilterWord.belongsTo(BilibiliUser, { foreignKey: 'bilibiliUserHostMid' })

BilibiliUser.hasMany(FilterTag, { foreignKey: 'bilibiliUserHostMid' })
FilterTag.belongsTo(BilibiliUser, { foreignKey: 'bilibiliUserHostMid' })

/**
 * B站数据库操作类
 */
export class BilibiliDBBase {
  /**
   * 构造函数
   */
  constructor() {
    this.sequelize = sequelize
    this.models = {
      Bot,
      Group,
      BilibiliUser,
      GroupUserSubscription,
      DynamicCache,
      FilterWord,
      FilterTag
    }
  }

  /**
   * 初始化数据库
   * @returns {Promise<BilibiliDBBase>} 返回初始化后的实例
   */
  async init() {
    try {
      logger.info('--------------------------[BilibiliDB] 开始初始化数据库--------------------------')
      await this.sequelize.authenticate()
      logger.info('[BilibiliDB] 数据库连接成功')

      await this.sequelize.sync({ force: true })
      logger.info('[BilibiliDB] 数据库模型同步成功')

      logger.info('[BilibiliDB] 正在同步配置订阅...')
      await this.syncConfigSubscriptions(Config.pushlist?.bilibili || [])
      logger.info('[BilibiliDB] 配置订阅同步成功')
      logger.info('--------------------------[BilibiliDB] 初始化数据库完成--------------------------')
    } catch (error) {
      logger.error('[BilibiliDB] 数据库初始化失败:', error)
      throw error
    }
    return this
  }

  /**
   * 获取或创建机器人记录
   * @param {string} botId 机器人ID
   * @returns {Promise<Object>} 机器人记录
   */
  async getOrCreateBot(botId) {
    const [bot] = await Bot.findOrCreate({
      where: { id: botId },
      defaults: { id: botId }
    })
    return bot
  }

  /**
   * 获取或创建群组记录
   * @param {string} groupId 群组ID
   * @param {string} botId 机器人ID
   * @returns {Promise<Object>} 群组记录
   */
  async getOrCreateGroup(groupId, botId) {
    await this.getOrCreateBot(botId)
    const [group] = await Group.findOrCreate({
      where: { id: groupId, botId },
      defaults: { id: groupId, botId }
    })
    return group
  }

  /**
   * 获取或创建B站用户记录
   * @param {number} host_mid B站用户UID
   * @param {string} [remark=''] UP主昵称
   * @returns B站用户记录
   */
  async getOrCreateBilibiliUser(host_mid, remark = '') {
    const [user, created] = await BilibiliUser.findOrCreate({
      where: { host_mid },
      defaults: { host_mid, remark }
    })
    if (!created && remark && user.remark !== remark) {
      user.remark = remark
      await user.save()
    }
    return user
  }

  /**
   * 订阅B站用户
   * @param {string} groupId 群组ID
   * @param {string} botId 机器人ID
   * @param {number} host_mid B站用户UID
   * @param {string} [remark=''] UP主昵称
   * @returns 订阅记录
   */
  async subscribeBilibiliUser(groupId, botId, host_mid, remark = '') {
    await this.getOrCreateGroup(groupId, botId)
    await this.getOrCreateBilibiliUser(host_mid, remark)

    const [subscription] = await GroupUserSubscription.findOrCreate({
      where: { groupId, host_mid },
      defaults: { groupId, host_mid }
    })
    return subscription
  }

  /**
   * 取消订阅B站用户
   * @param {string} groupId 群组ID
   * @param {number} host_mid B站用户UID
   * @returns {Promise<boolean>} 是否成功取消订阅
   */
  async unsubscribeBilibiliUser(groupId, host_mid) {
    const result = await GroupUserSubscription.destroy({
      where: { groupId, host_mid }
    })

    await DynamicCache.destroy({
      where: { groupId, host_mid }
    })

    return result > 0
  }

  /**
   * 添加动态缓存
   * @param {string} dynamic_id 动态ID
   * @param {number} host_mid B站用户UID
   * @param {string} groupId 群组ID
   * @param {string} dynamic_type 动态类型
   * @returns {Promise<Object>} 缓存记录
   */
  async addDynamicCache(dynamic_id, host_mid, groupId, dynamic_type) {
    const [cache] = await DynamicCache.findOrCreate({
      where: { dynamic_id, host_mid, groupId },
      defaults: { dynamic_id, host_mid, groupId, dynamic_type }
    })
    return cache
  }

  /**
   * 检查动态是否已推送
   * @param {string} dynamic_id 动态ID
   * @param {number} host_mid B站用户UID
   * @param {string} groupId 群组ID
   * @returns {Promise<boolean>} 是否已推送
   */
  async isDynamicPushed(dynamic_id, host_mid, groupId) {
    const count = await DynamicCache.count({
      where: { dynamic_id, host_mid, groupId }
    })
    return count > 0
  }

  /**
   * 根据机器人ID获取所有相关的群组信息
   * @param {string} botId - 机器人的唯一标识符
   * @returns 返回群组列表
   */
  async getBotGroups(botId) {
    return await Group.findAll({ where: { botId } })
  }

  /**
   * 获取指定群组的所有订阅信息
   * @param {number} groupId - 群组ID
   * @returns 返回包含订阅信息和对应B站用户信息的数组
   */
  async getGroupSubscriptions(groupId) {
    // 查询指定用户组下的所有订阅记录
    const subscriptions = await GroupUserSubscription.findAll({
      where: { groupId }
    })

    // 初始化结果数组
    const result = []
    for (const sub of subscriptions) {
      const user = await BilibiliUser.findOne({ where: { host_mid: sub.host_mid } })
      result.push({ ...sub.dataValues, BilibiliUser: user })
    }
    return result
  }

  /**
   * 获取用户订阅的所有群组信息
   * @param {number} host_mid - 用户ID
   * @returns 返回用户订阅的所有群组信息数组
   */
  async getUserSubscribedGroups(host_mid) {
    // 查询指定用户的所有订阅记录
    const subscriptions = await GroupUserSubscription.findAll({
      where: { host_mid }
    })

    // 如果没有订阅记录，返回空数组
    if (subscriptions.length === 0) return []

    // 从订阅记录中提取所有群组ID
    const groupIds = subscriptions.map(sub => sub.groupId)
    // 根据群组ID查询所有群组信息并返回
    return await Group.findAll({
      where: { id: { [Op.in]: groupIds } }
    })
  }

  /**
   * 检查群组是否已订阅B站用户
   * @param {number} host_mid B站用户UID
   * @param {string} groupId 群组ID
   * @returns {Promise<boolean>} 返回是否已订阅
   */
  async isSubscribed(host_mid, groupId) {
    const count = await GroupUserSubscription.count({
      where: { host_mid, groupId }
    })
    return count > 0
  }

  /**
   * 批量同步配置文件中的订阅到数据库
   * @param {bilibiliPushItem[]} configItems 配置文件中的订阅项
   * @returns {Promise<void>}
   */
  async syncConfigSubscriptions(configItems) {
    const configSubscriptions = new Map()

    for (const item of configItems) {
      const { host_mid, remark = '' } = item

      await this.getOrCreateBilibiliUser(host_mid, remark)

      for (const groupWithBot of item.group_id) {
        const [groupId, botId] = groupWithBot.split(':')
        if (!groupId || !botId) continue

        await this.getOrCreateGroup(groupId, botId)

        if (!configSubscriptions.has(groupId)) {
          configSubscriptions.set(groupId, new Set())
        }
        configSubscriptions.get(groupId).add(host_mid)

        const isSubscribed = await this.isSubscribed(host_mid, groupId)
        if (!isSubscribed) {
          await this.subscribeBilibiliUser(groupId, botId, host_mid, remark)
        }
      }
    }

    const allGroups = await Group.findAll()
    for (const group of allGroups) {
      const groupId = group.id
      const configUps = configSubscriptions.get(groupId) || new Set()

      const dbSubscriptions = await this.getGroupSubscriptions(groupId)

      for (const subscription of dbSubscriptions) {
        const host_mid = subscription.host_mid
        if (!configUps.has(host_mid)) {
          await this.unsubscribeBilibiliUser(groupId, host_mid)
          logger.info(`已删除群组 ${groupId} 对UP主 ${host_mid} 的订阅`)
        }
      }
    }

    const allUsers = await BilibiliUser.findAll()
    for (const user of allUsers) {
      const host_mid = user.host_mid
      const subscribedGroups = await this.getUserSubscribedGroups(host_mid)

      if (subscribedGroups.length === 0) {
        await FilterWord.destroy({ where: { bilibiliUserHostMid: host_mid } })
        await FilterTag.destroy({ where: { bilibiliUserHostMid: host_mid } })
        await BilibiliUser.destroy({ where: { host_mid } })
        logger.info(`已删除UP主 ${host_mid} 的记录及相关过滤设置（不再被任何群组订阅）`)
      }
    }
  }

  /**
   * 更新用户的过滤模式
   * @param {number} host_mid B站用户UID
   * @param {string} filterMode 过滤模式
   * @returns 返回更新后的用户记录
   */
  async updateFilterMode(host_mid, filterMode) {
    const user = await this.getOrCreateBilibiliUser(host_mid)
    user.filterMode = filterMode
    await user.save()
    return user
  }

  /**
   * 添加过滤词
   * @param {number} host_mid B站用户UID
   * @param {string} word 过滤词
   * @returns 返回过滤词记录
   */
  async addFilterWord(host_mid, word) {
    await this.getOrCreateBilibiliUser(host_mid)
    const [filterWord] = await FilterWord.findOrCreate({
      where: { bilibiliUserHostMid: host_mid, word },
      defaults: { host_mid, bilibiliUserHostMid: host_mid, word }
    })
    return filterWord
  }

  /**
   * 删除过滤词
   * @param {number} host_mid B站用户UID
   * @param {string} word 过滤词
   * @returns {Promise<boolean>} 返回是否成功删除
   */
  async removeFilterWord(host_mid, word) {
    const result = await FilterWord.destroy({
      where: { bilibiliUserHostMid: host_mid, word }
    })
    return result > 0
  }

  /**
   * 添加过滤标签
   * @param {number} host_mid B站用户UID
   * @param {string} tag 过滤标签
   * @returns 返回过滤标签记录
   */
  async addFilterTag(host_mid, tag) {
    await this.getOrCreateBilibiliUser(host_mid)
    const [filterTag] = await FilterTag.findOrCreate({
      where: { bilibiliUserHostMid: host_mid, tag },
      defaults: { host_mid, bilibiliUserHostMid: host_mid, tag }
    })
    return filterTag
  }

  /**
   * 删除过滤标签
   * @param {number} host_mid B站用户UID
   * @param {string} tag 过滤标签
   * @returns {Promise<boolean>} 返回是否成功删除
   */
  async removeFilterTag(host_mid, tag) {
    const result = await FilterTag.destroy({
      where: { bilibiliUserHostMid: host_mid, tag }
    })
    return result > 0
  }

  /**
   * 获取用户的所有过滤词
   * @param {number} host_mid B站用户UID
   * @returns {Promise<string[]>} 返回过滤词列表
   */
  async getFilterWords(host_mid) {
    const filterWords = await FilterWord.findAll({ where: { bilibiliUserHostMid: host_mid } })
    return filterWords.map(word => word.word)
  }

  /**
   * 获取用户的所有过滤标签
   * @param {number} host_mid B站用户UID
   * @returns {Promise<string[]>} 返回过滤标签列表
   */
  async getFilterTags(host_mid) {
    const filterTags = await FilterTag.findAll({ where: { bilibiliUserHostMid: host_mid } })
    return filterTags.map(tag => tag.tag)
  }

  /**
   * 获取用户的过滤配置
   * @param {number} host_mid B站用户UID
   * @returns {Promise<{filterMode: string, filterWords: string[], filterTags: string[]}>} 返回过滤配置
   */
  async getFilterConfig(host_mid) {
    const user = await this.getOrCreateBilibiliUser(host_mid)
    const filterWords = await this.getFilterWords(host_mid)
    const filterTags = await this.getFilterTags(host_mid)

    return {
      filterMode: user.filterMode,
      filterWords,
      filterTags
    }
  }

  /**
   * 检查内容是否应该被过滤
   * @param {BilibiliPushItem} PushItem 推送项
   * @param {string[]} [extraTags=[]] 额外的标签列表
   * @returns {Promise<boolean>} 返回是否应该过滤
   */
  async shouldFilter(PushItem, extraTags = []) {
    const { filterMode, filterWords, filterTags } = await this.getFilterConfig(PushItem.host_mid)

    const { text: mainText, tags: mainTags } = this.extractTextAndTags(PushItem.Dynamic_Data)
    let allTags = [...mainTags, ...extraTags]
    let allText = mainText

    if (PushItem.Dynamic_Data.type === 'DYNAMIC_TYPE_FORWARD' && PushItem.Dynamic_Data.orig) {
      const { text: origText, tags: origTags } = this.extractTextAndTags(PushItem.Dynamic_Data.orig)
      allText += ' ' + origText
      allTags = [...allTags, ...origTags]
    }

    const hasFilterWord = filterWords.some(word => allText.includes(word))
    const hasFilterTag = filterTags.some(filterTag =>
      allTags.some(tag => tag.includes(filterTag))
    )

    if (filterMode === 'blacklist') {
      if (hasFilterWord || hasFilterTag) {
        logger.warn(`动态内容命中黑名单规则，已过滤该动态不再推送`)
        return true
      }
      return false
    } else {
      if (filterWords.length === 0 && filterTags.length === 0) {
        return false
      }

      if (hasFilterWord || hasFilterTag) {
        return false
      }
      logger.warn(`动态内容未命中白名单规则，已过滤该动态不再推送`)
      return true
    }
  }

  /**
   * 从动态中提取文本内容和标签
   * @param {any} dynamicData 动态数据
   * @returns {{text: string, tags: string[]}} 返回提取的文本内容和标签
   */
  extractTextAndTags(dynamicData) {
    let text = ''
    const tags = []

    if (!dynamicData?.modules?.module_dynamic) {
      return { text, tags }
    }

    const moduleDynamic = dynamicData.modules.module_dynamic

    if (moduleDynamic.major?.live_rcmd) {
      const content = JSON.parse(moduleDynamic.major.live_rcmd.content)
      text += content.live_play_info.title + ' '
      tags.push(content.live_play_info.area_name)
    }

    if (moduleDynamic.desc?.text) {
      text += moduleDynamic.desc.text + ' '
    }

    if (moduleDynamic.major?.archive?.title) {
      text += moduleDynamic.major.archive.title + ' '
    }

    if (moduleDynamic.desc?.rich_text_nodes) {
      for (const node of moduleDynamic.desc.rich_text_nodes) {
        if (node.type !== 'RICH_TEXT_NODE_TYPE_TEXT') {
          tags.push(node.orig_text)
        }
      }
    }

    return { text: text.trim(), tags }
  }

  /**
   * 清理旧的动态缓存数据
   * @param {number} days - 要保留的天数，默认为7天
   * @returns {Promise<number>} 返回删除操作的结果，即删除的记录数
   */
  async cleanOldDynamicCache(days = 7) {
    // 计算截止日期，即当前日期减去指定天数
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // 执行删除操作，删除所有在截止日期之前创建的缓存记录
    const result = await DynamicCache.destroy({
      where: {
        // 只删除创建时间早于截止日期的记录
        createdAt: { [Op.lt]: cutoffDate }
      }
    })

    return result
  }
}

export const bilibiliModels = {
  Bot,
  Group,
  BilibiliUser,
  GroupUserSubscription,
  DynamicCache,
  FilterWord,
  FilterTag
}
