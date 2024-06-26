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
 * @param {string} group_id 推送群唯一标识符
 * @param {string} data 数据对象
 * @returns {Promise<remake>}
 */
async function CreateSheet (ModelName, group_id, data = {}) {
  const Model = sequelize.models[ModelName]
  return (
    await Model.create(
      {
        group_id: String(group_id),
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
 * @returns  获取对应表单的所有群组原始数据
 */
async function FindAll (ModelName) {
  const Model = sequelize.models[ModelName]
  const groups = await Model.findAll({
    raw: true
  })

  // 使用reduce方法将数组转换为对象
  const result = groups.reduce((accumulator, group) => {
    // 将group_id作为键名，data作为键值
    accumulator[group.group_id] = JSON.parse(group.data)
    return accumulator
  }, {})

  return result
}

/**
 * 查找指定群号的数据
 * @param {string} ModelName 表单名称
 * @param {string} Group_ID 群号
 * @returns {Promise} 包含指定群号数据的Promise对象
 */
async function FindGroup (ModelName, Group_ID) {
  const AllData = await FindAll(ModelName)
  // 检查传入的 Group_ID 是否存在于 AllData 中
  // eslint-disable-next-line no-prototype-builtins
  if (AllData.hasOwnProperty(Group_ID)) {
    // 直接返回找到的群号对应的对象
    return AllData[Group_ID]
  } else {
    return null
  }
}

/**
 * 更新指定群组的数据
 * @param {string} ModelName 表单名称
 * @param {number} Group_ID 推送群唯一标识符
 * @param {object} NewData 数据对象
 * @returns
 */
async function UpdateGroupData (ModelName, Group_ID, NewData = {}) {
  const Model = sequelize.models[ModelName]

  // eslint-disable-next-line no-unused-vars
  const [affectedRows, affectedRowsData] = await Model.update(
    {
      data: JSON.stringify(NewData)
    },
    {
      where: {
        group_id: Group_ID
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
