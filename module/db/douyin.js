import { Version, Config, logger } from '../utils/index.js'
import { Sequelize, DataTypes, Op } from 'sequelize'
import { join } from 'node:path'

/**
 * @typedef {import('../utils/Config.js').douyinPushItem} douyinPushItem
 */

/**
 * @typedef {import('../platform/douyin/push.js').DouyinPushItem} DouyinPushItem
 */

// 创建数据库连接
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(Version.pluginPath, 'data', 'douyin.db'),
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

const DouyinUser = sequelize.define('DouyinUser', {
  sec_uid: {
    type: DataTypes.STRING,
    primaryKey: true,
    comment: '抖音用户sec_uid'
  },
  short_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '抖音号'
  },
  remark: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '抖音用户昵称'
  },
  living: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否正在直播'
  },
  filterMode: {
    type: DataTypes.STRING,
    defaultValue: 'blacklist',
    comment: '过滤模式：黑名单或白名单'
  }
}, {
  timestamps: true,
  tableName: 'DouyinUsers'
})

const GroupUserSubscription = sequelize.define('GroupUserSubscription', {
  groupId: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    comment: '群组ID'
  },
  sec_uid: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    comment: '抖音用户sec_uid'
  }
}, {
  timestamps: true,
  tableName: 'GroupUserSubscriptions'
})

const AwemeCache = sequelize.define('AwemeCache', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '缓存ID'
  },
  aweme_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '作品ID'
  },
  sec_uid: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '抖音用户sec_uid'
  },
  groupId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '群组ID'
  }
}, {
  timestamps: true,
  tableName: 'AwemeCaches'
})

const FilterWord = sequelize.define('FilterWord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '过滤词ID'
  },
  sec_uid: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '抖音用户sec_uid'
  },
  word: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '过滤词'
  },
  douyinUserSecUid: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '抖音用户sec_uid外键'
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
  sec_uid: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '抖音用户sec_uid'
  },
  tag: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '过滤标签'
  },
  douyinUserSecUid: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '抖音用户sec_uid外键'
  }
}, {
  timestamps: true,
  tableName: 'FilterTags'
})

// 定义关联关系
Bot.hasMany(Group, { foreignKey: 'botId' })
Group.belongsTo(Bot, { foreignKey: 'botId' })

Group.belongsToMany(DouyinUser, {
  through: GroupUserSubscription,
  foreignKey: 'groupId',
  otherKey: 'sec_uid'
})
DouyinUser.belongsToMany(Group, {
  through: GroupUserSubscription,
  foreignKey: 'sec_uid',
  otherKey: 'groupId'
})

Group.hasMany(AwemeCache, { foreignKey: 'groupId' })
AwemeCache.belongsTo(Group, { foreignKey: 'groupId' })

DouyinUser.hasMany(AwemeCache, { foreignKey: 'sec_uid' })
AwemeCache.belongsTo(DouyinUser, { foreignKey: 'sec_uid' })

DouyinUser.hasMany(FilterWord, { foreignKey: 'douyinUserSecUid' })
FilterWord.belongsTo(DouyinUser, { foreignKey: 'douyinUserSecUid' })

DouyinUser.hasMany(FilterTag, { foreignKey: 'douyinUserSecUid' })
FilterTag.belongsTo(DouyinUser, { foreignKey: 'douyinUserSecUid' })

/**
 * 抖音数据库操作类
 */
export class DouyinDBBase {
  /**
   * 构造函数
   */
  constructor() {
    this.sequelize = sequelize
    this.models = {
      Bot,
      Group,
      DouyinUser,
      GroupUserSubscription,
      AwemeCache,
      FilterWord,
      FilterTag
    }
  }

  /**
   * 初始化数据库
   * @returns {Promise<DouyinDBBase>} 返回初始化后的实例
   */
  async init() {
    try {
      logger.info('--------------------------[DouyinDB] 开始初始化数据库--------------------------')
      await this.sequelize.authenticate()
      logger.info('[DouyinDB] 数据库连接成功')

      await this.sequelize.sync({ force: true })
      logger.info('[DouyinDB] 数据库模型同步成功')

      logger.info('[DouyinDB] 正在同步配置订阅...')
      await this.syncConfigSubscriptions(Config.pushlist?.douyin || [])
      logger.info('[DouyinDB] 配置订阅同步成功')
      logger.info('--------------------------[DouyinDB] 初始化数据库完成--------------------------')
    } catch (error) {
      logger.error('[DouyinDB] 数据库初始化失败:', error)
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
   * 获取或创建抖音用户记录
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} [short_id=''] 抖音号
   * @param {string} [remark=''] 用户昵称
   * @returns {Promise<any>} 抖音用户记录
   */
  async getOrCreateDouyinUser(sec_uid, short_id = '', remark = '') {
    const [user, created] = await DouyinUser.findOrCreate({
      where: { sec_uid },
      defaults: { sec_uid, short_id, remark }
    })

    if (!created) {
      let needUpdate = false
      if (remark && user.remark !== remark) {
        user.remark = remark
        needUpdate = true
      }
      if (short_id && user.short_id !== short_id) {
        user.short_id = short_id
        needUpdate = true
      }
      if (needUpdate) {
        await user.save()
      }
    }
    return user
  }

  /**
   * 订阅抖音用户
   * @param {string} groupId 群组ID
   * @param {string} botId 机器人ID
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} [short_id=''] 抖音号
   * @param {string} [remark=''] 用户昵称
   * @returns {Promise<Object>} 订阅记录
   */
  async subscribeDouyinUser(groupId, botId, sec_uid, short_id = '', remark = '') {
    await this.getOrCreateGroup(groupId, botId)
    await this.getOrCreateDouyinUser(sec_uid, short_id, remark)

    const [subscription] = await GroupUserSubscription.findOrCreate({
      where: { groupId, sec_uid },
      defaults: { groupId, sec_uid }
    })
    return subscription
  }

  /**
   * 取消订阅抖音用户
   * @param {string} groupId 群组ID
   * @param {string} sec_uid 抖音用户sec_uid
   * @returns {Promise<boolean>} 是否成功取消订阅
   */
  async unsubscribeDouyinUser(groupId, sec_uid) {
    const result = await GroupUserSubscription.destroy({
      where: { groupId, sec_uid }
    })

    await AwemeCache.destroy({
      where: { groupId, sec_uid }
    })

    return result > 0
  }

  /**
   * 添加作品缓存
   * @param {string} aweme_id 作品ID
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} groupId 群组ID
   * @returns {Promise<Object>} 缓存记录
   */
  async addAwemeCache(aweme_id, sec_uid, groupId) {
    const [cache] = await AwemeCache.findOrCreate({
      where: { aweme_id, sec_uid, groupId },
      defaults: { aweme_id, sec_uid, groupId }
    })
    return cache
  }

  /**
   * 检查作品是否已推送
   * @param {string} aweme_id 作品ID
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} groupId 群组ID
   * @returns {Promise<boolean>} 是否已推送
   */
  async isAwemePushed(aweme_id, sec_uid, groupId) {
    const count = await AwemeCache.count({
      where: { aweme_id, sec_uid, groupId }
    })
    return count > 0
  }

  /**
   * 获取机器人推送的所有群组
   * @param {string} botId 机器人ID
   */
  async getBotGroups(botId) {
    return await Group.findAll({ where: { botId } })
  }

  /**
   * 获取当前群订阅的所有抖音用户
   * @param {string} groupId 群ID
   */
  async getGroupSubscriptions(groupId) {
    const subscriptions = await GroupUserSubscription.findAll({
      where: { groupId }
    })

    const result = []
    for (const sub of subscriptions) {
      const user = await DouyinUser.findOne({ where: { sec_uid: sub.sec_uid } })
      result.push({ ...sub.dataValues, DouyinUser: user })
    }
    return result
  }

  /**
   * 获取抖音用户的所有订阅群组
   * @param {string} sec_uid 抖音用户sec_uid
   */
  async getUserSubscribedGroups(sec_uid) {
    const subscriptions = await GroupUserSubscription.findAll({
      where: { sec_uid }
    })

    if (subscriptions.length === 0) return []

    const groupIds = subscriptions.map(sub => sub.groupId)
    return await Group.findAll({
      where: { id: { [Op.in]: groupIds } }
    })
  }

  /**
   * 检查群组是否已订阅抖音用户
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} groupId 群组ID
   * @returns {Promise<boolean>} 返回是否已订阅
   */
  async isSubscribed(sec_uid, groupId) {
    const count = await GroupUserSubscription.count({
      where: { sec_uid, groupId }
    })
    return count > 0
  }

  /**
   * 获取抖音用户信息
   * @param {string} sec_uid 抖音用户sec_uid
   */
  async getDouyinUser(sec_uid) {
    return await DouyinUser.findOne({ where: { sec_uid } })
  }

  /**
   * 更新用户直播状态
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {boolean} living 是否正在直播
   */
  async updateLiveStatus(sec_uid, living) {
    const user = await DouyinUser.findOne({ where: { sec_uid } })
    if (!user) return false

    user.living = living
    await user.save()
    return true
  }

  /**
   * 获取用户直播状态
   * @param {string} sec_uid 抖音用户sec_uid
   * @returns {Promise<{living: boolean}>} 返回直播状态
   */
  async getLiveStatus(sec_uid) {
    const user = await DouyinUser.findOne({ where: { sec_uid } })
    if (!user) return { living: false }

    return { living: user.living }
  }

  /**
   * 批量同步配置文件中的订阅到数据库
   * @param {douyinPushItem[]} configItems 配置文件中的订阅项
   * @returns {Promise<void>}
   */
  async syncConfigSubscriptions(configItems) {
    const configSubscriptions = new Map()

    for (const item of configItems) {
      const { sec_uid, short_id = '', remark = '' } = item

      await this.getOrCreateDouyinUser(sec_uid, short_id, remark)

      for (const groupWithBot of item.group_id) {
        const [groupId, botId] = groupWithBot.split(':')
        if (!groupId || !botId) continue

        await this.getOrCreateGroup(groupId, botId)

        if (!configSubscriptions.has(groupId)) {
          configSubscriptions.set(groupId, new Set())
        }
        configSubscriptions.get(groupId).add(sec_uid)

        const isSubscribed = await this.isSubscribed(sec_uid, groupId)
        if (!isSubscribed) {
          await this.subscribeDouyinUser(groupId, botId, sec_uid, short_id, remark)
        }
      }
    }

    const allGroups = await Group.findAll()
    for (const group of allGroups) {
      const groupId = group.id
      const configUsers = configSubscriptions.get(groupId) || new Set()

      const dbSubscriptions = await this.getGroupSubscriptions(groupId)

      for (const subscription of dbSubscriptions) {
        const sec_uid = subscription.sec_uid
        if (!configUsers.has(sec_uid)) {
          await this.unsubscribeDouyinUser(groupId, sec_uid)
          logger.info(`已删除群组 ${groupId} 对抖音用户 ${sec_uid} 的订阅`)
        }
      }
    }

    const allUsers = await DouyinUser.findAll()
    for (const user of allUsers) {
      const sec_uid = user.sec_uid
      const subscribedGroups = await this.getUserSubscribedGroups(sec_uid)

      if (subscribedGroups.length === 0) {
        await FilterWord.destroy({ where: { douyinUserSecUid: sec_uid } })
        await FilterTag.destroy({ where: { douyinUserSecUid: sec_uid } })
        await DouyinUser.destroy({ where: { sec_uid } })
        logger.info(`已删除抖音用户 ${sec_uid} 的记录及相关过滤设置（不再被任何群组订阅）`)
      }
    }
  }

  /**
   * 通过ID获取群组信息
   * @param {string} groupId 群组ID
   */
  async getGroupById(groupId) {
    return await Group.findOne({ where: { id: groupId } })
  }

  /**
   * 更新用户的过滤模式
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} filterMode 过滤模式
   */
  async updateFilterMode(sec_uid, filterMode) {
    const user = await this.getOrCreateDouyinUser(sec_uid)
    user.filterMode = filterMode
    await user.save()
    return user
  }

  /**
   * 添加过滤词
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} word 过滤词
   */
  async addFilterWord(sec_uid, word) {
    await this.getOrCreateDouyinUser(sec_uid)
    const [filterWord] = await FilterWord.findOrCreate({
      where: { douyinUserSecUid: sec_uid, word },
      defaults: { sec_uid, douyinUserSecUid: sec_uid, word }
    })
    return filterWord
  }

  /**
   * 删除过滤词
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} word 过滤词
   * @returns {Promise<boolean>} 返回是否成功删除
   */
  async removeFilterWord(sec_uid, word) {
    const result = await FilterWord.destroy({
      where: { douyinUserSecUid: sec_uid, word }
    })
    return result > 0
  }

  /**
   * 添加过滤标签
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} tag 过滤标签
   */
  async addFilterTag(sec_uid, tag) {
    await this.getOrCreateDouyinUser(sec_uid)
    const [filterTag] = await FilterTag.findOrCreate({
      where: { douyinUserSecUid: sec_uid, tag },
      defaults: { sec_uid, douyinUserSecUid: sec_uid, tag }
    })
    return filterTag
  }

  /**
   * 删除过滤标签
   * @param {string} sec_uid 抖音用户sec_uid
   * @param {string} tag 过滤标签
   * @returns {Promise<boolean>} 返回是否成功删除
   */
  async removeFilterTag(sec_uid, tag) {
    const result = await FilterTag.destroy({
      where: { douyinUserSecUid: sec_uid, tag }
    })
    return result > 0
  }

  /**
   * 获取用户的所有过滤词
   * @param {string} sec_uid 抖音用户sec_uid
   * @returns {Promise<string[]>} 返回过滤词列表
   */
  async getFilterWords(sec_uid) {
    const filterWords = await FilterWord.findAll({ where: { douyinUserSecUid: sec_uid } })
    return filterWords.map(word => word.word)
  }

  /**
   * 根据用户的sec_uid获取过滤标签列表
   * @param {string} sec_uid - 抖音用户的唯一标识符
   */
  async getFilterTags(sec_uid) {
    const filterTags = await FilterTag.findAll({ where: { douyinUserSecUid: sec_uid } })
    return filterTags.map(tag => tag.tag)
  }

  /**
   * 获取用户的过滤配置信息
   * @param {string} sec_uid - 用户的唯一标识符
   * @returns {Promise<Object>} 包含过滤模式、过滤词和过滤标签的对象
   */
  async getFilterConfig(sec_uid) {
    // 获取或创建抖音用户信息
    const user = await this.getOrCreateDouyinUser(sec_uid)
    // 获取用户的过滤词列表
    const filterWords = await this.getFilterWords(sec_uid)
    // 获取用户的过滤标签列表
    const filterTags = await this.getFilterTags(sec_uid)

    // 返回包含过滤配置的对象
    return {
      filterMode: user.filterMode,
      filterWords,
      filterTags
    }
  }

  /**
   * 检查内容是否应该被过滤
   * @param {DouyinPushItem} PushItem 推送项
   * @param {string[]} [tags=[]] 标签列表
   * @returns {Promise<boolean>} 返回是否应该过滤
   */
  async shouldFilter(PushItem, tags = []) {
    const sec_uid = PushItem.sec_uid
    if (!sec_uid) {
      logger.warn(`推送项缺少 sec_uid 参数: ${JSON.stringify(PushItem)}`)
      return false
    }

    // @ts-ignore
    const { filterMode, filterWords, filterTags } = await this.getFilterConfig(sec_uid)
    const desc = PushItem.Detail_Data?.desc || ''

    const hasFilterWord = filterWords.some((/** @type {any} */ word) => desc.includes(word))
    const hasFilterTag = filterTags.some((/** @type {string} */ filterTag) =>
      tags.some(tag => tag === filterTag)
    )

    if (filterMode === 'blacklist') {
      if (hasFilterWord || hasFilterTag) {
        logger.warn(`作品内容命中黑名单规则，已过滤该作品不再推送`)
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
      logger.warn(`作品内容未命中白名单规则，已过滤该作品不再推送`)
      return true
    }
  }

  /**
   * 清理旧的Aweme缓存数据
   * @param {number} days - 清理多少天之前的数据，默认为7天
   * @returns {Promise<number>} 返回删除操作的结果
   */
  async cleanOldAwemeCache(days = 7) {
    // 计算截止日期，默认为7天前
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // 执行删除操作，删除创建时间早于截止日期的缓存记录
    const result = await AwemeCache.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate } // 使用小于操作符筛选创建时间早于截止日期的记录
      }
    })

    // 返回删除操作的结果
    return result
  }

}

export const douyinModels = {
  Bot,
  Group,
  DouyinUser,
  GroupUserSubscription,
  AwemeCache,
  FilterWord,
  FilterTag
}
