import { sequelize, DataTypes } from './base.js'

sequelize.define(
  'douyin',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: '主键ID'
    },
    bot_id: {
      type: DataTypes.STRING, // 存储为字符串，JSON 格式
      comment: '机器人标识符'
    },
    group_id: {
      type: DataTypes.STRING,
      comment: '群组标识符'
    },
    data: {
      type: DataTypes.STRING, // 存储为字符串，JSON 格式
      defaultValue: '{}',
      comment: '缓存数据'
    },
    aweme_idlist: {
      type: DataTypes.STRING,
      defaultValue: '[]',
      comment: '已推送的抖音视频 ID 列表'
    }
  },
  {
    timestamps: true
  }
)

sequelize.define(
  'bilibili',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: '主键ID'
    },
    bot_id: {
      type: DataTypes.STRING, // 存储为字符串，JSON 格式
      comment: '机器人标识符'
    },
    group_id: {
      type: DataTypes.STRING,
      comment: '群组标识符'
    },
    data: {
      type: DataTypes.STRING, // 存储为字符串，JSON 格式
      defaultValue: '{}',
      comment: '缓存数据'
    },
    dynamic_idlist: {
      type: DataTypes.STRING,
      defaultValue: '[]',
      comment: '已推送的B站动态 ID 列表'
    }
  },
  {
    timestamps: true
  }
)

/**
 * 创建一个新的群组记录，具有默认值的新条目
 * @param {string} ModelName 表单名称
 * @param {string} bot_id 机器人标识符
 * @param {string} group_id 推送群唯一标识符
 * @param {string} data 数据对象
 * @returns {Promise<remake>}
 */
async function CreateSheet (ModelName, bot_id, group_id, data = {}) {
  const Model = sequelize.models[ModelName]
  const nestedData = {
    "bot_id": {
      [bot_id]:[group_id]
    }
  }
  return (
    await Model.create(
      {
        bot_id: JSON.stringify(nestedData),
        data: JSON.stringify(data)
      },
      {
        raw: true
      }
    )
  ).dataValues
}

/**
 * 获取对应表单的所有群组原始数据
 * @param {string} ModelName 表单名称
 * @returns 获取对应表单的所有群组原始数据
 */
async function FindAll(ModelName) {
  const Model = sequelize.models[ModelName]
  const groups = await Model.findAll({
    raw: true
  })

  // 使用reduce方法将数组转换为嵌套对象
  const result = groups.reduce((accumulator, group) => {
    const nestedData = JSON.parse(group.bot_id)
    const bot_id = Object.keys(nestedData.bot_id)[0]
    const group_ids = nestedData.bot_id[bot_id]
    accumulator[bot_id] = accumulator[bot_id] || []
    accumulator[bot_id].push(...group_ids)
    return accumulator
  }, {})

  return result
}

/**
 * 查找指定群号的数据
 * @param {string} ModelName 表单名称
 * @param {string} bot_id 机器人标识符
 * @param {string} group_id 群号
 * @returns {Promise} 包含指定群号数据的Promise对象
 */
async function FindGroup(ModelName, bot_id, group_id) {
  const Model = sequelize.models[ModelName]
  const result = await Model.findOne({
    where: {
      bot_id: JSON.stringify({ "bot_id": { [bot_id]: [group_id] } })
    },
    raw: true
  })

  return result ? JSON.parse(result.data) : null
}

/**
 * 更新指定群组的数据
 * @param {string} ModelName 表单名称
 * @param {string} bot_id 机器人标识符
 * @param {string} group_id 推送群唯一标识符
 * @param {object} NewData 数据对象
 * @returns
 */
async function UpdateGroupData(ModelName, bot_id, group_id, NewData = {}) {
  const Model = sequelize.models[ModelName]
  const existingData = await FindGroup(ModelName, bot_id, group_id) || {}
  existingData[bot_id] = existingData[bot_id] || []
  if (!existingData[bot_id].includes(group_id)) {
    existingData[bot_id].push(group_id)
  }

  const nestedData = {
    "bot_id": {
      [bot_id]: existingData[bot_id]
    }
  }

  const [affectedRows, affectedRowsData] = await Model.update(
    {
      bot_id: JSON.stringify(nestedData),
      data: JSON.stringify(NewData)
    },
    {
      where: {
        bot_id: JSON.stringify({ "bot_id": { [bot_id]: [group_id] } })
      },
      individualHooks: true
    }
  )

  return affectedRowsData
}

const DB = {
  /** 创建一个新的群组记录，具有默认值的新条目 */
  CreateSheet,
  /** 更新指定群组的数据 */
  UpdateGroupData,
  /** 获取对应表单的所有群组原始数据 */
  FindAll,
  /** 查找指定群号的数据 */
  FindGroup
}

export default DB

/** 每次调用都将强制同步已定义的模型 */
await sequelize.sync({ alter: true })
