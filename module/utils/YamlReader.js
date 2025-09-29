import fs from 'fs'
import YAML from 'yaml'

/**
 * YamlReader类提供了对YAML文件的动态读写功能
 */
export default class YamlReader {
  /**
   * 创建一个YamlReader实例。
   * @param {string} filePath - 文件路径
   */
  constructor(filePath) {
    this.filePath = filePath
    this.document = null
    try {
      this.document = this.parseDocument()
    } catch (error) {
      logger.error(`解析YAML文件失败: ${filePath}`, error)
      // 创建空文档作为回退
      this.document = new YAML.Document({})
    }
  }

  /**
   * 解析YAML文件并返回Document对象，保留注释。
   * @returns {*} 包含YAML数据和注释的Document对象
   */
  parseDocument() {
    try {
      const fileContent = fs.readFileSync(this.filePath, 'utf8')
      return YAML.parseDocument(fileContent)
    } catch (/** @type {*} */ error) {
      logger.error(`读取YAML文件失败: ${this.filePath}`, error)
    }
  }

  /**
   * 修改指定参数的值。
   * @param {string} key - 参数键名
   * @param {any} value - 新的参数值
   * @returns {boolean} 操作是否成功
   */
  set(key, value) {
    try {
      // 检查键名是否包含点号
      if (key.includes('.')) {
        // 将带点号的键名转换为路径数组
        const path = key.split('.')
        this.document.setIn(path, value)
      } else {
        // 对于不带点号的键名，直接设置
        this.document.set(key, value)
      }
      return this.write()
    } catch (error) {
      logger.error(`设置YAML配置失败 [${key}]:`, error)
      return false
    }
  }

  /**
   * 从YAML文件中删除指定参数。
   * @param {string} key - 要删除的参数键名
   * @returns {boolean} 操作是否成功
   */
  rm(key) {
    try {
      if (key.includes('.')) {
        const path = key.split('.')
        this.document.deleteIn(path)
      } else {
        this.document.delete(key)
      }
      return this.write()
    } catch (error) {
      logger.error(`删除YAML配置失败 [${key}]:`, error)
      return false
    }
  }

  /**
   * 获取指定参数的值
   * @param {string} key - 参数键名
   * @returns {any} 参数值，如果不存在则返回undefined
   */
  get(key) {
    try {
      if (key.includes('.')) {
        const path = key.split('.')
        return this.document.getIn(path)
      } else {
        return this.document.get(key)
      }
    } catch (error) {
      logger.error(`获取YAML配置失败 [${key}]:`, error)
      return undefined
    }
  }

  /**
   * 将更新后的Document对象写入YAML文件中。
   * @returns {boolean} 操作是否成功
   */
  write() {
    try {
      fs.writeFileSync(this.filePath,
        this.document.toString({
          lineWidth: -1,
          simpleKeys: true
        }), 'utf8')
      return true
    } catch (error) {
      logger.error(`写入YAML文件失败: ${this.filePath}`, error)
      return false
    }
  }
}
