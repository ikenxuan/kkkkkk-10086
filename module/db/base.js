import { join } from 'path'
import fs from 'fs'
import { Sequelize, DataTypes } from 'sequelize'
import { Version } from '#components'

const mkdirSync = (...dirPath) => {
  let path = Version.pluginPath
  for (const i of dirPath) {
    path = join(path, i)
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path)
    }
  }
}

mkdirSync('data', 'db', 'sqlite')

const dataPath = join(Version.pluginPath, 'data', 'db', 'sqlite', 'data.db')

/** 创建 Sequelize 实例，需要传入配置对象。 */
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dataPath,
  logging: false,
})

/** 测试数据库连接是否成功 */
await sequelize.authenticate()

export { sequelize, DataTypes }
