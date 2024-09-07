import _ from 'lodash'
import YAML from 'yaml'
import fs from 'node:fs'
import logger from '../lib/public/logger.js'
import Version from '../components/Version.js'
import chokidar from 'chokidar'
import YamlReader from './YamlReader.js'

class Config {
  constructor () {
    this.config = {}
    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }
    this.initCfg()
    this.transition()
  }

  /** 初始化配置 */
  initCfg () {
    let path
    if(Version.BotName === 'Karin') path = `${Version.pluginPath}/config/`
    path = `${Version.pluginPath}/config/config/`
    if (!fs.existsSync(path)) fs.mkdirSync(path)
    const pathDef = `${Version.pluginPath}/config/default_config/`
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))
    for (const file of files) {
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      } else {
        const config = YAML.parse(fs.readFileSync(`${path}${file}`, 'utf8'))
        const defConfig = YAML.parse(fs.readFileSync(`${pathDef}${file}`, 'utf8'))
        const { differences, result } = this.mergeObjectsWithPriority(config, defConfig)
        if (differences) {
          fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
          for (const key in result) {
            this.modify(file.replace('.yaml', ''), key, result[key])
          }
        }
      }
      this.watch(`${path}${file}`, file.replace('.yaml', ''), 'config')
    }
  }

  /** json 转 yaml */
  transition () {
    if (!fs.existsSync(`${Version.pluginPath}/config/config.json`, 'utf8')) {
      return
    }
    const oldCfg = JSON.parse(fs.readFileSync(`${Version.pluginPath}/config/config.json`, 'utf8'))
    const configMap = {
      cookies: [ 'douyin', 'bilibili' ],
      app: [
        'priority', 'filelimit', 'defaulttool', 'rmmp4',
        'sendforwardmsg', 'usefilelimit', 'videotool'
      ],
      bilibili: [
        'bilibilicommentsimg', 'bilibilinumcomments',
        'bilibilipush', 'bilibilipushcron', 'bilibilipushGroup',
        'bilibilipushlog', 'bilibilitip', 'bilibilitool'
      ],
      douyin: [ 'comments', 'commentsimg', 'douyinpush',
        'douyinpushcron', 'douyinpushGroup', 'douyinpushlog',
        'douyintip', 'douyintool', 'numcomments', 'sendHDrecord' ], // 省略douyin相关配置项
      pushlist: {
        douyin: oldCfg.douyinpushlist.map(item => ({
          ...item
        })),
        bilibili: oldCfg.bilibilipushlist.map(item => ({
          ...item
        }))
      }
    }
    for (const [ category, keys ] of Object.entries(configMap)) {
      switch (category) {
        case 'cookies':
          for (const key of keys) {
            this.modify(category, key, key === 'douyin' ? oldCfg['ck'] : oldCfg['bilibilick'])
          }
          break
        case 'pushlist':
          for (const [ subCategory, items ] of Object.entries(keys)) {
            this.modify(category, subCategory, items)
          }
          break
        default:
          for (const key of keys) {
            this.modify(category, key, oldCfg[key])
          }
      }
    }
    const newCfg = this.All()
    fs.unlinkSync(`${Version.pluginPath}/config/config.json`)
    return newCfg
  }

  /** 插件相关配置 */
  get app () {
    return this.getDefOrConfig('app')
  }

  /** ck相关配置 */
  get cookies () {
    return this.getDefOrConfig('cookies')
  }

  /** 抖音相关配置 */
  get douyin () {
    return this.getDefOrConfig('douyin')
  }

  /** B站相关配置 */
  get bilibili () {
    return this.getDefOrConfig('bilibili')
  }

  /** 推送列表 */
  get pushlist () {
    return this.getDefOrConfig('pushlist')
  }

  get kuaishou () {
    return this.getDefOrConfig('kuaishou')
  }

  All () {
    return {
      cookies: this.cookies,
      app: this.app,
      douyin: this.douyin,
      bilibili: this.bilibili,
      pushlist: this.pushlist,
      kuaishou: this.kuaishou
    }
  }

  /** 默认配置和用户配置 */
  getDefOrConfig (name) {
    const def = this.getdefSet(name)
    const config = this.getConfig(name)
    return { ...def, ...config }
  }

  /** 默认配置 */
  getdefSet (name) {
    return this.getYaml('default_config', name)
  }

  /** 用户配置 */
  getConfig (name) {
    return this.getYaml('config', name)
  }

  /**
   * 获取配置yaml
   * @param type 默认跑配置-defSet，用户配置-config
   * @param name 名称
   */
  getYaml (type, name) {
    const file = `${Version.pluginPath}/config/${type}/${name}.yaml`
    const key = `${type}.${name}`

    if (this.config[key]) return this.config[key]

    this.config[key] = YAML.parse(
      fs.readFileSync(file, 'utf8')
    )

    this.watch(file, name, type)

    return this.config[key]
  }

  /** 监听配置文件 */
  watch (file, name, type = 'default_config') {
    const key = `${type}.${name}`
    if (this.watcher[key]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', async path => {
      delete this.config[key]
      logger.mark(`[${Version.pluginName}][修改配置文件][${type}][${name}]`)
    })

    this.watcher[key] = watcher
  }

  /**
   * 修改设置
   * @param {'cookies','app','douyin','bilibili','pushlist'} name 文件名
   * @param {String} key 修改的key值
   * @param {String|Number} value 修改的value值
   * @param {'config'|'default_config'} type 配置文件或默认
   */
  modify (name, key, value, type = 'config') {
    const path = `${Version.pluginPath}/config/${type}/${name}.yaml`
    new YamlReader(path).set(key, value)
    delete this.config[`${type}.${name}`]
  }

  mergeObjectsWithPriority (objA, objB) {
    let differences = false

    function customizer (objValue, srcValue, key, object, source, stack) {
      if (_.isArray(objValue) && _.isArray(srcValue)) {
        return objValue
      } else if (_.isPlainObject(objValue) && _.isPlainObject(srcValue)) {
        if (!_.isEqual(objValue, srcValue)) {
          return _.mergeWith({}, objValue, srcValue, customizer)
        }
      } else if (!_.isEqual(objValue, srcValue)) {
        differences = true
        return objValue !== undefined ? objValue : srcValue
      }
      return objValue !== undefined ? objValue : srcValue
    }

    const result = _.mergeWith({}, objA, objB, customizer)

    return {
      differences,
      result
    }
  }
}
export default new Config()
