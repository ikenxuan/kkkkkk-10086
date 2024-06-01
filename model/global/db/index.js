import { sequelize, DataTypes } from './base.js'

/**
 *
 * @param {string} ModelName 表单名称
 * @param {string} group_id 推送群唯一标识符
 * @param {string} data 数据对象
 * @returns {Promise<remake>}
 * 创建一个新的群组记录，具有默认值的新条目
 */
async function CreateSheet(ModelName, group_id, data = {}) {
  const Model = sequelize.models[ModelName]
  return (
    await Model.create(
      {
        group_id: String(group_id),
        data: JSON.stringify(data),
      },
      {
        raw: true,
      },
    )
  ).dataValues
}

/**
 *
 * @param {string} ModelName 表单名称
 * @returns  获取对应表单的所有群组原始数据
 */
async function FindAll(ModelName) {
  const Model = sequelize.models[ModelName]
  const groups = await Model.findAll({
    raw: true,
  })

  const formattedGroups = groups.map((group) => ({
    group_id: group.group_id,
    data: JSON.parse(group.data),
  }))

  return formattedGroups
}

/**
 *
 * @param {string} ModelName 表单名称
 * @param {number} Group_ID 推送群唯一标识符
 * @param {object} NewData 数据对象
 * @returns
 */
async function UpdateGroupData(ModelName, Group_ID, NewData = {}) {
  const Model = sequelize.models[ModelName]

  const [affectedRows, affectedRowsData] = await Model.update(
    {
      data: JSON.stringify(NewData),
    },
    {
      where: {
        group_id: Group_ID,
      },
      individualHooks: true,
    },
  )

  console.log(`更新了 ${affectedRows} 条记录`)
  return affectedRowsData
}

const DB = {
  CreateSheet,
  UpdateGroupData,
  FindAll,
}

export default DB

const douyinbasemodel = [
  {
    remark: '',
    sec_uid: '',
    aweme_idlist: [],
  },
]

const douyin = sequelize.define(
  'douyin',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: '主键ID',
    },
    group_id: {
      type: DataTypes.STRING,
      comment: '群组标识符',
    },
    data: {
      type: DataTypes.STRING, // 存储为字符串，JSON 格式
      defaultValue: JSON.stringify(douyinbasemodel),
      comment: '已推送的抖音视频 ID 列表',
    },
  },
  {
    timestamps: true,
  },
)

const bilibili = sequelize.define(
  'bilibili',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: '主键ID',
    },
    group_id: {
      type: DataTypes.STRING,
      comment: '群组标识符',
    },
    data: {
      type: DataTypes.STRING, // 存储为字符串，JSON 格式
      defaultValue: '{}',
      comment: '已推送的抖音视频 ID 列表',
    },
  },
  {
    timestamps: true,
  },
)

/** 每次调用都将强制同步已定义的模型 */
await sequelize.sync({ alter: true })
