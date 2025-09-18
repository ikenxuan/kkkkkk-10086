import YamlReader from './YamlReader.js'
import { logger } from './index.js'
import Version from './Version.js'
import chokidar from 'chokidar'
import fs from 'node:fs'
import _ from 'lodash'
import YAML from 'yaml'

/**
 * @typedef {Object} CookiesConfig
 * @property {string} [CookiesConfig.bilibili] B站平台Cookie信息
 * @property {string} [CookiesConfig.douyin] 抖音平台Cookie信息
 * @property {string} [CookiesConfig.kuaishou] 快手平台Cookie信息
 */

/**
 * @typedef {Object} AppConfig
 * @property {boolean} [AppConfig.videotool] 视频解析工具总开关，修改后重启生效
 * @property {boolean} [AppConfig.defaulttool] 默认解析，即识别最高优先级，修改后重启生效
 * @property {boolean} [AppConfig.removeCache] 缓存删除，非必要不修改！
 * @property {number} [AppConfig.priority] 自定义优先级，「默认解析」关闭后才会生效。修改后重启生效
 * @property {boolean} [AppConfig.sendforwardmsg] 发送合并转发消息，可能多用于抖音解析
 * @property {number} [AppConfig.Theme] 评论图、推送图是否使用深色主题 0为根据时间自动切换 1为浅色 2为深色
 * @property {number} [AppConfig.renderScale] 渲染精度，可选值50~200，建议100。设置高精度会提高图片的精细度，过高可能会影响渲染与发送速度
 * @property {boolean} [AppConfig.APIServer] 放出API服务（本地部署一个抖音、B站的api服务）
 * @property {number} [AppConfig.APIServerPort] API服务端口
 */

/**
 * @typedef {Object} DouyinPushConfig
 * @property {boolean} [switch] 推送开关
 * @property {string} [permission] 谁可以设置推送
 * @property {string} [cron] 推送定时任务的cron表达式
 * @property {boolean} [parsedynamic] 推送时是否一同解析该作品
 * @property {boolean} [log] 是否打印日志
 * @property {'web'|'download'} [shareType] 分享链接二维码的类型
 */

/**
 * @typedef {Object} DouyinConfig
 * @property {boolean} [DouyinConfig.douyintool] 抖音解析开关
 * @property {string[]} [DouyinConfig.douyinTip] 抖音解析可选列表
 * @property {number} [DouyinConfig.numcomments] 抖音评论数量
 * @property {boolean} [DouyinConfig.realCommentCount] 评论图是否显示真实评论数量
 * @property {boolean} [DouyinConfig.commentsimg] 发送抖音作品评论图开关
 * @property {boolean} [DouyinConfig.detailMusic] 发送抖音背景音乐开关
 * @property {boolean} [DouyinConfig.sendHDrecord] 图集BGM是否使用高清语音发送
 * @property {boolean} [DouyinConfig.autoResolution] 根据「视频拦截阈值」自动选择合适的分辨率
 * @property {DouyinPushConfig} [DouyinConfig.push] 抖音推送相关配置
 */

/**
 * @typedef {Object} BilibiliPushConfig
 * @property {boolean} [switch] 推送开关
 * @property {string} [permission] 谁可以设置推送
 * @property {string} [cron] 推送定时任务的cron表达式
 * @property {boolean} [parsedynamic] 推送时是否一同解析该动态
 * @property {boolean} [log] 是否打印日志
 * @property {number} [pushVideoQuality] 推送时视频画质偏好设置
 * @property {number} [pushMaxAutoVideoSize] 推送时视频体积上限
 */

/**
 * @typedef {Object} BilibiliConfig
 * @property {boolean} [BilibiliConfig.bilibilitool] B站解析开关
 * @property {string[]} [BilibiliConfig.bilibiliTip] B站解析可选列表
 * @property {number} [BilibiliConfig.bilibilinumcomments] B站评论数量
 * @property {boolean} [BilibiliConfig.realCommentCount] 评论图是否显示真实评论数量
 * @property {boolean} [BilibiliConfig.videopriority] 解析视频是否优先保内容
 * @property {number} [BilibiliConfig.videoQuality] 视频画质偏好设置
 * @property {number} [BilibiliConfig.maxAutoVideoSize] 自动画质模式下可接受的最大视频大小
 * @property {string[]} [BilibiliConfig.displayContent] 视频解析时简介显示的内容
 * @property {BilibiliPushConfig} [BilibiliConfig.push] B站推送相关配置
 */

/**
 * @typedef {Object} douyinPushItem
 * @property {boolean} switch - 是否启用
 * @property {string} sec_uid - sec_uid，与short_id二选一
 * @property {string} short_id - 抖音号，与sec_uid二选一
 * @property {string[]} group_id - 推送群号和机器人账号，多个则使用逗号隔开，必填。如：群号1:机器人账号1
 * @property {string} remark - 博主或UP主的名字信息，可不填
 * @property {'blacklist'|'whitelist'} [filterMode='blacklist'] - 黑名单：命中不推送；白名单：命中才推送
 * @property {string[]} [Keywords] - 指定关键词
 * @property {string[]} [Tags] - 指定标签
 */

/**
 * 定义推送列表项的接口
 * @typedef {Object} bilibiliPushItem
 * @property {boolean} switch - 是否启用
 * @property {number} host_mid - B站用户的UID，必填
 * @property {string[]} group_id - 推送群号和机器人账号，多个则使用逗号隔开，必填。如：群号1:机器人账号1
 * @property {string} [remark] - 博主或UP主的名字信息，可不填
 * @property {'blacklist'|'whitelist'} [filterMode='blacklist'] - 黑名单：命中不推送；白名单：命中才推送
 * @property {string[]} [Keywords] - 指定关键词
 * @property {string[]} [Tags] - 指定标签
 */

/**
 * @typedef {Object} PushlistConfig
 * @property {douyinPushItem[]} [PushlistConfig.douyin] - 抖音推送配置列表
 * @property {bilibiliPushItem[]} [PushlistConfig.bilibili] - B站推送配置列表
 */

/**
 * @typedef {Object} KuaishouConfig
 * @property {boolean} [KuaishouConfig.kuaishoutool] 快手解析开关
 * @property {boolean} [KuaishouConfig.kuaishoutip] 快手解析提示开关
 * @property {number} [KuaishouConfig.kuaishounumcomments] 快手评论数量
 */

/**
 * @typedef {Object} ProxyAuth
 * @property {string} username 用户名
 * @property {string} password 密码
 */

/**
 * @typedef {Object} ProxyConfig
 * @property {boolean} switch 是否启用代理
 * @property {string} host 代理服务器主机地址
 * @property {string} port 代理服务器端口
 * @property {string} protocol 代理协议类型(http/https)
 * @property {ProxyAuth} auth 代理服务器认证信息
 */

/**
 * @typedef {Object} RequestConfig
 * @property {number} timeout 请求超时时间，单位：毫秒
 * @property {string} User-Agent 用户代理
 * @property {ProxyConfig} proxy 代理配置
 */

/**
 * @typedef {Object} UploadConfig
 * @property {boolean} [UploadConfig.sendbase64] 发送视频经本插件转换为base64格式后再发送，适合Karin与机器人不在同一网络环境下开启
 * @property {boolean} [UploadConfig.usefilelimit] 视频上传拦截，开启后会根据解析的视频文件大小判断是否需要上传
 * @property {number} [UploadConfig.filelimit] 视频拦截阈值（填数字），视频文件大于该数值则不会上传 单位: MB，「视频文件上传限制」开启后才会生效
 * @property {boolean} [UploadConfig.compress] 压缩视频，开启后会将视频文件压缩后再上传，适合上传大文件
 * @property {number} [UploadConfig.compresstrigger] 触发视频压缩的阈值，单位：MB。当文件大小超过该值时，才会压缩视频，「压缩视频」开启后才会生效
 * @property {number} [UploadConfig.compressvalue] 压缩后的值，若视频文件大小大于「触发视频压缩的阈值」的值，则会进行压缩至该值（±5%），「压缩视频」开启后才会生效
 * @property {boolean} [UploadConfig.usegroupfile] 使用文件上传，开启后会将视频文件上传到群文件中，私聊也行
 * @property {number} [UploadConfig.groupfilevalue] 群文件上传阈值，当文件大小超过该值时将使用群文件上传，单位：MB，「使用群文件上传」开启后才会生效
 */

/**
 * @typedef {Object} ConfigType
 * @property {CookiesConfig} cookies - Cookie相关配置
 * @property {AppConfig} app - 应用相关配置
 * @property {DouyinConfig} douyin - 抖音相关配置
 * @property {BilibiliConfig} bilibili - B站相关配置
 * @property {PushlistConfig} pushlist - 推送列表配置
 * @property {KuaishouConfig} kuaishou - 快手相关配置
 * @property {UploadConfig} upload - 上传相关配置
 */

/**
 * @typedef {Object} AllConfigType
 * @property {CookiesConfig} cookies - Cookie相关配置
 * @property {AppConfig} app - 应用相关配置
 * @property {DouyinConfig} douyin - 抖音相关配置
 * @property {BilibiliConfig} bilibili - B站相关配置
 * @property {PushlistConfig} pushlist - 推送列表配置
 * @property {KuaishouConfig} kuaishou - 快手相关配置
 * @property {RequestConfig} request - 请求相关配置
 * @property {UploadConfig} upload - 上传相关配置
 */

class Config {
  /** @type {Record<string, any>} 配置缓存对象 */
  config = {}

  /** @type {Record<string, any>} 文件监听器对象 */
  watcher = { config: {}, defSet: {} }
  constructor() {
    this.config = {}
    this.watcher = { config: {}, defSet: {} }
    this.initCfg()
  }
  /**
   * 初始化配置系统
   * - 创建配置目录（如果不存在）
   * - 从默认配置目录复制配置文件
   * - 合并用户配置和默认配置
   * - 设置文件监听
   * @returns {void}
   */
  initCfg() {
    // 用户配置目录路径
    const path = `${Version.pluginPath}/config/config/`
    // 创建配置目录（如果不存在）
    if (!fs.existsSync(path)) fs.mkdirSync(path)
    // 默认配置目录路径
    const pathDef = `${Version.pluginPath}/config/default_config/`
    // 获取所有yaml配置文件
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))

    // 处理每个配置文件
    for (const file of files) {
      // 如果用户配置不存在，复制默认配置
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      } else {
        // 解析用户配置和默认配置
        const config = YAML.parse(fs.readFileSync(`${path}${file}`, 'utf8'))
        const defConfig = YAML.parse(fs.readFileSync(`${pathDef}${file}`, 'utf8'))
        // 合并配置并检查差异
        /** @type {{differences: boolean, result: Record<string, any>}} */
        const { differences, result } = this.mergeObjectsWithPriority(config, defConfig)
        // 如果有差异，更新配置文件
        if (differences) {
          fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
          for (const key in result) {
            this.modify(file.replace('.yaml', ''), key, result[key])
          }
        }
      }
      // 监听配置文件变化
      this.watch(`${path}${file}`, file.replace('.yaml', ''), 'config')
    }
  }

  /**
   * 获取应用相关配置
   * @returns {AppConfig} 应用配置对象，包含应用运行相关设置
   * 
   * @example
   * // 获取应用配置
   * const appConfig = Config.app
   * console.log(appConfig.videotool)      // 访问视频解析工具总开关
   * console.log(appConfig.defaulttool)    // 访问默认解析开关
   * console.log(appConfig.removeCache)    // 访问缓存删除设置
   * console.log(appConfig.priority)       // 访问优先级设置
   * console.log(appConfig.sendforwardmsg) // 访问合并转发消息设置
   * console.log(appConfig.Theme)          // 访问主题设置
   * console.log(appConfig.renderScale)    // 访问渲染精度设置
   * console.log(appConfig.APIServer)      // 访问API服务开关
   * console.log(appConfig.APIServerPort)  // 访问API服务端口
   */
  get app() {
    return this.getDefOrConfig('app')
  }

  /**
   * 获取Cookie相关配置
   * @returns {CookiesConfig} Cookie配置对象，包含各平台Cookie信息
   * 
   * @example
   * // 获取Cookie配置
   * const cookieConfig = Config.cookies
   * console.log(cookieConfig.douyin)   // 访问抖音Cookie
   * console.log(cookieConfig.bilibili) // 访问B站Cookie
   * console.log(cookieConfig.kuaishou) // 访问快手Cookie
   */
  get cookies() {
    return this.getDefOrConfig('cookies')
  }

  /**
   * 获取抖音相关配置
   * @returns {DouyinConfig} 抖音配置对象，包含抖音功能相关设置
   * 
   * @example
   * // 获取抖音配置
   * const douyinConfig = Config.douyin
   * console.log(douyinConfig.douyintool)     // 访问抖音解析开关
   * console.log(douyinConfig.douyinTip)      // 访问抖音解析可选列表
   * console.log(douyinConfig.numcomments)    // 访问评论数量设置
   * console.log(douyinConfig.commentsimg)    // 访问评论图设置
   * console.log(douyinConfig.detailMusic)    // 访问背景音乐设置
   * console.log(douyinConfig.sendHDrecord)   // 访问高清语音设置
   * console.log(douyinConfig.push)           // 访问推送配置
   */
  get douyin() {
    return this.getDefOrConfig('douyin')
  }

  /**
   * 获取B站相关配置
   * @returns {BilibiliConfig} B站配置对象，包含B站功能相关设置
   * 
   * @example
   * // 获取B站配置
   * const bilibiliConfig = Config.bilibili
   * console.log(bilibiliConfig.bilibilitool)        // 访问B站解析开关
   * console.log(bilibiliConfig.bilibiliTip)         // 访问B站解析可选列表
   * console.log(bilibiliConfig.bilibilinumcomments) // 访问评论数量设置
   * console.log(bilibiliConfig.senddynamicvideo)    // 访问动态视频设置
   * console.log(bilibiliConfig.videopriority)       // 访问视频优先级设置
   * console.log(bilibiliConfig.videoQuality)        // 访问视频画质设置
   * console.log(bilibiliConfig.maxAutoVideoSize)    // 访问最大视频大小设置
   * console.log(bilibiliConfig.displayContent)      // 访问显示内容设置
   * console.log(bilibiliConfig.push)                // 访问推送配置
   */
  get bilibili() {
    return this.getDefOrConfig('bilibili')
  }

  /**
   * 获取推送列表配置
   * @returns {PushlistConfig} 推送列表配置对象，包含各平台推送设置
   * 
   * @example
   * // 获取推送列表配置
   * const pushConfig = Config.pushlist
   * console.log(pushConfig.douyin) // 访问抖音推送设置
   */
  get pushlist() {
    return this.getDefOrConfig('pushlist')
  }

  /**
   * 获取快手相关配置
   * @returns {KuaishouConfig} 快手配置对象，包含快手功能相关设置
   * 
   * @example
   * // 获取快手配置
   * const kuaishouConfig = Config.kuaishou
   * console.log(kuaishouConfig.comments)     // 访问评论设置
   * console.log(kuaishouConfig.videoQuality) // 访问视频清晰度设置
   */
  get kuaishou() {
    return this.getDefOrConfig('kuaishou')
  }

  /**
   * 获取请求相关配置
   * @returns {RequestConfig} 请求配置对象，包含超时、代理等设置
   * 
   * @example
   * // 获取请求配置
   * const requestConfig = Config.request
   * console.log(requestConfig.timeout)    // 访问超时设置
   * console.log(requestConfig['User-Agent']) // 访问用户代理
   * console.log(requestConfig.proxy)      // 访问代理设置
   */
  get request() {
    return this.getDefOrConfig('request')
  }

  /**
   * 获取上传相关配置
   * @returns {UploadConfig} 上传配置对象，包含视频上传、压缩等设置
   * 
   * @example
   * // 获取上传配置
   * const uploadConfig = Config.upload
   * console.log(uploadConfig.sendbase64)     // 访问base64发送设置
   * console.log(uploadConfig.compress)       // 访问视频压缩设置
   * console.log(uploadConfig.usegroupfile)   // 访问群文件上传设置
   */
  get upload() {
    return this.getDefOrConfig('upload')
  }

  /**
   * 获取所有配置项的聚合对象
   * @returns {AllConfigType} 包含所有配置项的对象
   * 
   * @example
   * // 获取所有配置
   * const allConfigs = Config.All()
   * console.log(allConfigs.app)      // 访问应用配置
   * console.log(allConfigs.douyin)   // 访问抖音配置
   * console.log(allConfigs.bilibili) // 访问B站配置
   * console.log(allConfigs.kuaishou) // 访问快手配置
   */
  All() {
    return {
      cookies: this.cookies,
      app: this.app,
      douyin: this.douyin,
      bilibili: this.bilibili,
      pushlist: this.pushlist,
      kuaishou: this.kuaishou,
      request: this.request,
      upload: this.upload
    }
  }

  /**
   * 获取合并后的配置（默认配置 + 用户配置）
   * 用户配置会覆盖默认配置中的相同项
   * @param {string} name - 配置文件名称（不包含.yaml扩展名）
   * @returns {any} 合并后的配置对象
   * 
   * @example
   * // 获取app配置
   * const appConfig = Config.getDefOrConfig('app')
   */
  getDefOrConfig(name) {
    // 获取默认配置
    const def = this.getdefSet(name)
    // 获取用户配置
    const config = this.getConfig(name)
    // 合并配置，用户配置优先级更高
    return { ...def, ...config }
  }

  /**
   * 获取默认配置
   * @param {string} name - 配置文件名称（不包含.yaml扩展名）
   * @returns {any} 默认配置对象
   * 
   * @example
   * // 获取默认的cookies配置
   * const defaultCookies = Config.getdefSet('cookies')
   */
  getdefSet(name) {
    return this.getYaml('default_config', name)
  }

  /**
   * 获取用户配置
   * @param {string} name - 配置文件名称（不包含.yaml扩展名）
   * @returns {any} 用户配置对象
   * 
   * @example
   * // 获取用户配置的douyin设置
   * const userDouyinConfig = Config.getConfig('douyin')
   */
  getConfig(name) {
    return this.getYaml('config', name)
  }

  /**
   * 获取配置yaml文件内容
   * @param {string} type - 配置类型，'default_config'表示默认配置，'config'表示用户配置
   * @param {string} name - 配置文件名称（不包含.yaml扩展名）
   * @returns {any} 返回解析后的配置对象
   * 
   * @example
   * // 获取默认配置
   * const defaultConfig = Config.getYaml('default_config', 'app')
   * 
   * @example
   * // 获取用户配置
   * const userConfig = Config.getYaml('config', 'cookies')
   */
  getYaml(type, name) {
    // 构建配置文件完整路径
    const file = `${Version.pluginPath}/config/${type}/${name}.yaml`
    // 构建缓存键名
    const key = `${type}.${name}`

    // 如果配置已缓存，直接返回
    if (this.config[key]) return this.config[key]

    try {
      // 检查文件是否存在
      if (!fs.existsSync(file)) {
        // 文件不存在时返回空对象
        this.config[key] = {}
      } else {
        // 读取并解析YAML文件
        this.config[key] = YAML.parse(fs.readFileSync(file, 'utf8'))
      }
    } catch (error) {
      // 解析失败时返回空对象
      logger.warn(`[Config] 解析配置文件失败: ${file}`)
      this.config[key] = {}
    }

    // 监听配置文件变化
    this.watch(file, name, type)

    // 返回配置对象
    return this.config[key]
  }

  /**
   * 监听配置文件变化
   * @param {string} file - 要监听的文件完整路径
   * @param {string} name - 配置文件名称（不带扩展名）
   * @param {string} [type='default_config'] - 配置类型，默认为默认配置
   * @returns {void}
   */
  watch(file, name, type = 'default_config') {
    const key = `${type}.${name}`
    // 如果已经在监听，则直接返回
    if (this.watcher[key]) return

    // 创建文件监听器
    const watcher = chokidar.watch(file)
    // 文件变化时的处理
    watcher.on('change', async () => {
      // 删除缓存的配置
      delete this.config[key]
      // 记录日志
      logger.mark(`[${Version.pluginName}][修改配置文件][${type}][${name}]`)
    })

    // 保存监听器实例
    this.watcher[key] = watcher
  }

  /**
   * 修改配置文件中的指定项
   * @param {string} name - 配置文件名 ['cookies' | 'app' | 'douyin' | 'bilibili' | 'pushlist']
   * @param {string} key - 要修改的配置项键名
   * @param {*} value - 要设置的新值
   * @param {'config' | 'default_config'} [type='config'] - 配置类型，默认为用户配置
   * @returns {void}
   * 
   * @example
   * // 修改应用配置中的优先级
   * Config.modify('app', 'priority', 1)
   * 
   * @example
   * // 修改抖音配置中的评论设置
   * Config.modify('douyin', 'comments', true)
   * 
   * @example
   * // 修改默认配置中的Cookie
   * Config.modify('cookies', 'douyin', 'your-cookie', 'default_config')
   * 
   */
  modify(name, key, value, type = 'config') {
    // 构建配置文件完整路径
    const path = `${Version.pluginPath}/config/${type}/${name}.yaml`
    // 使用YamlReader修改配置
    new YamlReader(path).set(key, value)
    // 清除对应的配置缓存
    delete this.config[`${type}.${name}`]
  }

  /**
   * 合并两个对象并保留优先级
   * @param {Object} objA 第一个对象（具有较高优先级）
   * @param {Object} objB 第二个对象（具有较低优先级）
   * @returns {{differences: boolean, result: Object}} 返回合并结果和差异状态
   * @property {boolean} differences - 是否存在差异
   * @property {Object} result - 合并后的对象
   */
  mergeObjectsWithPriority(objA, objB) {
    let differences = false

    /**
     * 自定义合并函数
     * @param {Object} objValue - 目标对象的值
     * @param {Object} srcValue - 源对象的值
     * @returns {Object} 合并后的值
     */
    const customizer = (objValue, srcValue) => {
      if (_.isArray(objValue) && _.isArray(srcValue)) {
        return objValue
      } else if (_.isPlainObject(objValue) && _.isPlainObject(srcValue)) {
        if (!_.isEqual(objValue, srcValue)) {
          return _.mergeWith(_.cloneDeep(objValue), srcValue, customizer)
        }
      } else if (!_.isEqual(objValue, srcValue)) {
        differences = true
        return objValue !== undefined ? objValue : srcValue
      }
      return objValue !== undefined ? objValue : srcValue
    }

    let result = _.mergeWith(_.cloneDeep(objA), objB, customizer)

    return {
      differences,
      result
    }
  }

}

/**
 * @type {Config}
 */
export default new Config()
