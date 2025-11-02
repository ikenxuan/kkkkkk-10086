import { Config, Render, Version, Common } from '../module/utils/index.js'
import { bilibiliLogin } from '../module/platform/bilibili/login.js'
// import { dylogin } from '../module/platform/douyin/login.js'
import fs from 'fs'

const APPType = {
  缓存删除: 'removeCache',
  视频解析工具总开关: 'videotool',
  默认解析: 'defaulttool',
  发送合并转发消息: 'sendforwardmsg',
  深色主题: 'Theme',
  渲染精度: 'renderScale',
  放出API服务: 'APIServer',
  API服务端口: 'APIServerPort',
  自定义优先级: 'priority'
}

const DouYinType = {
  抖音解析开关: 'douyintool',
  抖音评论数量: 'numcomments',
  抖音真实评论数量: 'realCommentCount',
  抖音高清语音: 'sendHDrecord',
  抖音自动分辨率: 'autoResolution',
  抖音推送开关: 'push.switch',
  抖音推送解析: 'push.parsedynamic',
  抖音推送日志: 'push.log'
}

const BilibiliType = {
  B站解析开关: 'bilibilitool',
  B站评论数量: 'bilibilinumcomments',
  B站真实评论数量: 'realCommentCount',
  B站内容优先: 'videopriority',
  B站画质偏好: 'videoQuality',
  B站自动画质大小: 'maxAutoVideoSize',
  B站推送开关: 'push.switch',
  B站推送解析: 'push.parsedynamic',
  B站推送日志: 'push.log',
  B站推送画质: 'push.pushVideoQuality',
  B站推送大小: 'push.pushMaxAutoVideoSize'
}

const KuaiShouType = {
  快手解析开关: 'kuaishoutool',
  快手解析提示: 'kuaishoutip',
  快手评论数量: 'kuaishounumcomments'
}

const UploadType = {
  发送视频base64: 'sendbase64',
  视频上传拦截: 'usefilelimit',
  视频拦截阈值: 'filelimit',
  压缩视频: 'compress',
  触发压缩阈值: 'compresstrigger',
  压缩后的值: 'compressvalue',
  使用文件上传: 'usegroupfile',
  群文件上传阈值: 'groupfilevalue'
}

const RequestType = {
  请求超时时间: 'timeout',
  代理开关: 'proxy.switch'
}

const QualityMap = {
  0: '自动',
  6: '极速 240P',
  16: '流畅 360P',
  32: '清晰 480P',
  64: '高清 720P',
  74: '高帧率 720P60',
  80: '高清 1080P',
  112: '高码率 1080P+',
  116: '高帧率 1080P60',
  120: '超清 4K',
  125: '真彩色 HDR',
  126: '杜比视界',
  127: '超高清 8K'
}

const NumberCfgType = {
  抖音评论数量: { type: 'douyin', key: 'numcomments', limit: '1-50' },
  B站评论数量: { type: 'bilibili', key: 'bilibilinumcomments', limit: '1-20' },
  快手评论数量: { type: 'kuaishou', key: 'kuaishounumcomments', limit: '1-30' },
  渲染精度: { type: 'app', key: 'renderScale', limit: '50-200' },
  优先级: { type: 'app', key: 'priority', limit: '0-10000' },
  API服务端口: { type: 'app', key: 'APIServerPort', limit: '1000-65535' },
  B站画质偏好: { type: 'bilibili', key: 'videoQuality', limit: [0, 6, 16, 32, 64, 74, 80, 112, 116, 120, 127] },
  B站自动画质大小: { type: 'bilibili', key: 'maxAutoVideoSize', limit: '1-200' },
  B站推送画质: { type: 'bilibili', key: 'push.pushVideoQuality', limit: [0, 6, 16, 32, 64, 74, 80, 112, 116, 120, 127] },
  B站推送大小: { type: 'bilibili', key: 'push.pushMaxAutoVideoSize', limit: '1-200' },
  视频拦截阈值: { type: 'upload', key: 'filelimit', limit: '5-200' },
  触发压缩阈值: { type: 'upload', key: 'compresstrigger', limit: '5-200' },
  压缩后的值: { type: 'upload', key: 'compressvalue', limit: '5-200' },
  群文件上传阈值: { type: 'upload', key: 'groupfilevalue', limit: '5-200' },
  请求超时时间: { type: 'request', key: 'timeout', limit: '5000-60000' },
  深色主题: { type: 'app', key: 'Theme', limit: '0-2' }
}

const SwitchCfgType = {
  ...APPType,
  ...DouYinType,
  ...BilibiliType,
  ...KuaiShouType,
  ...UploadType,
  ...RequestType
}

const FileWitch = {
  app: APPType,
  douyin: DouYinType,
  bilibili: BilibiliType,
  kuaishou: KuaiShouType,
  upload: UploadType,
  request: RequestType
}

// 转义正则特殊字符
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SwitchCfgReg = new RegExp(`^#kkk设置(${Object.keys(SwitchCfgType).map(escapeRegex).join('|')})\\s*(开启|关闭)$`, 'i')
const NumberCfgReg = new RegExp(`^#kkk设置(${Object.keys(NumberCfgType).map(escapeRegex).join('|')})\\s*(\\d+)$`, 'i')

export class kkkAdmin extends plugin {
  constructor() {
    super({
      name: 'kkkkkk-10086-设置',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: SwitchCfgReg,
          fnc: 'ConfigSwitch',
          permission: 'master'
        },
        {
          reg: NumberCfgReg,
          fnc: 'ConfigNumber',
          permission: 'master'
        },
        {
          reg: /^#kkk设置$/,
          fnc: 'index_Settings',
          permission: 'master'
        },
        {
          reg: /^#?(kkk)?\s*设置抖音ck$/i,
          fnc: 'setdyck',
          permission: 'master'
        },
        {
          reg: /^#?(kkk)?\s*设置\s*([Bb]站)ck$/i,
          fnc: 'setbilick',
          permission: 'master'
        },
        {
          reg: /^#?(kkk)?\s*设置快手ck$/i,
          fnc: 'setksck',
          permission: 'master'
        },
        {
          reg: /^#?(kkk)?\s*[Bb]站\s*(扫码)?\s*登录$/i,
          fnc: 'Blogin',
          permission: 'master'
        },
        {
          reg: /^#?(kkk)?\s*抖音(扫码)?\s*登录$/i,
          fnc: 'dylogin',
          permission: 'master'
        },
        {
          reg: /^#?kkk删除缓存$/,
          fnc: 'deltemp',
          permission: 'master'
        }
      ]
    })

    // 使用 this.task 定义定时任务
    this.task = []
    if (Config.app.removeCache) {
      this.task.push({
        cron: '0 0 4 * * *',  // 每天凌晨4点执行
        name: '[kkkkkk-10086] 视频缓存自动删除',
        fnc: () => this.deltemp(),
        log: true
      })
    }
  }

  async deltemp() {
    await removeAllFiles(Common.tempDri.video)
      .then(() => logger.warn(Common.tempDri.video + '所有文件已删除'))
      .catch((err) => logger.error('删除文件时出错:', err))
    return true
  }

  async ConfigSwitch(e) {
    const regRet = SwitchCfgReg.exec(e.msg)
    let key = regRet[1].replace(/b站/g, 'B站')
    const file = Object.entries(FileWitch).find(([, values]) => Object.keys(values).includes(key))?.[0]
    if (!file) {
      await e.reply('配置项不存在')
      return false
    }
    const is = regRet[2] === '开启'
    const _key = SwitchCfgType[key]
    Config.modify(file, _key, is)
    await this.index_Settings(e)
    return true
  }

  async ConfigNumber(e) {
    const regRet = e.msg.match(NumberCfgReg)
    if (!regRet) return false
    let key = regRet[1].replace(/b站/g, 'B站')
    const type = NumberCfgType[key]
    if (!type) {
      await e.reply('配置项不存在')
      return false
    }
    const number = checkNumberValue(regRet[2], type.limit)
    Config.modify(type.type, type.key, number)
    await this.index_Settings(e)
    return true
  }

  async index_Settings(e) {
    const _cfg = await Config.All()
    const data = {
      // Cookies
      ...Object.fromEntries(Object.keys(_cfg.cookies).map(k => [k, getStatus(_cfg.cookies[k], true)])),
      // App
      ...Object.fromEntries(Object.keys(_cfg.app).map(k => [k, getStatus(_cfg.app[k])])),
      // Douyin
      ...Object.fromEntries(Object.keys(_cfg.douyin).filter(k => k !== 'push').map(k => [k, getStatus(_cfg.douyin[k])])),
      ...mapPushConfig('douyin', _cfg.douyin.push),
      // Bilibili
      ...Object.fromEntries(Object.keys(_cfg.bilibili).filter(k => k !== 'push' && k !== 'realCommentCount' && k !== 'videoQuality' && k !== 'maxAutoVideoSize').map(k => [k, getStatus(_cfg.bilibili[k])])),
      bilibiliRealCommentCount: getStatus(_cfg.bilibili.realCommentCount),
      videoQuality: getStatus(_cfg.bilibili.videoQuality, false, false, true),
      maxAutoVideoSize: getStatus(_cfg.bilibili.maxAutoVideoSize),
      ...mapPushConfig('bilibili', _cfg.bilibili.push),
      // Kuaishou
      ...Object.fromEntries(Object.keys(_cfg.kuaishou).map(k => [k, getStatus(_cfg.kuaishou[k])])),
      // Upload
      ...Object.fromEntries(Object.keys(_cfg.upload).map(k => [k, getStatus(_cfg.upload[k])])),
      // Request
      timeout: getStatus(_cfg.request.timeout),
      userAgent: getStatus(_cfg.request['User-Agent']),
      ...mapProxyConfig(_cfg.request.proxy)
    }

    await e.reply(await Render('admin/index', { data }))
    return true
  }

  async Blogin(e) {
    await bilibiliLogin(e)
    return true
  }

  async dylogin(e) {
    // await dylogin(e)
    logger.warn('暂未修复抖音登录问题')
    return true
  }

  async setdyck() {
    this.setContext('savedyck')
    this.reply('请在120秒内发送抖音ck\n教程：https://ikenxuan.github.io/kkkkkk-10086/docs/intro/other#%E9%85%8D%E7%BD%AE%E4%B8%8D%E5%90%8C%E5%B9%B3%E5%8F%B0%E7%9A%84-cookies', true)
    return true
  }

  async savedyck() {
    Config.modify('cookies', 'douyin', String(this.e.msg))
    this.reply('设置成功！')
    this.finish('savedyck')
    return true
  }

  async setbilick() {
    this.setContext('savebilick')
    this.reply('请在120秒内发送B站ck\n教程：https://ikenxuan.github.io/kkkkkk-10086/docs/intro/other#%E9%85%8D%E7%BD%AE%E4%B8%8D%E5%90%8C%E5%B9%B3%E5%8F%B0%E7%9A%84-cookies')
    return true
  }

  async savebilick() {
    Config.modify('cookies', 'bilibili', String(this.e.msg))
    this.reply('设置成功！')
    this.finish('savebilick')
    return true
  }

  async setksck() {
    this.setContext('saveksck')
    const img = `${Version}/plugins/kkkkkk-10086/resources/image/pic1.png`
    this.reply(['请发送快手ck\n', '教程：https://docs.qq.com/doc/DRExRWUh1a3l4bnlI\n', segment.image(img)])
    return true
  }

  async saveksck() {
    Config.modify('cookies', 'kuaishou', String(this.e.msg))
    this.reply('设置成功！')
    this.finish('saveksck')
    return true
  }
}

/**
 * 映射推送配置到数据对象
 * @param {string} prefix - 前缀（douyin/bilibili）
 * @param {Object} pushConfig - 推送配置对象
 * @returns {Object} 映射后的配置对象
 */
function mapPushConfig(prefix, pushConfig) {
  if (!pushConfig) return {}

  // 定义推送配置键名映射表，将yaml中的键名转换为HTML模板中使用的键名
  // 例：switch -> douyinpush / bilibilipush
  const keyMap = {
    switch: 'push',                           // 推送开关
    permission: 'pushpermission',             // 推送权限
    cron: 'pushcron',                         // 推送定时表达式
    parsedynamic: 'pushparsedynamic',         // 推送时是否解析
    log: 'pushlog',                           // 推送日志
    shareType: 'pushshareType',               // 分享类型（仅抖音）
    pushVideoQuality: 'pushVideoQuality',     // 推送画质（仅B站）
    pushMaxAutoVideoSize: 'pushMaxAutoVideoSize' // 推送视频大小限制（仅B站）
  }

  const result = {}
  Object.keys(pushConfig).forEach(key => {
    // 拼接最终的键名：prefix + 映射后的键名
    const mappedKey = `${prefix}${keyMap[key] || key}`
    // 判断是否为画质配置，需要特殊处理将数字转换为画质描述
    const isQuality = key === 'pushVideoQuality'
    result[mappedKey] = getStatus(pushConfig[key], false, false, isQuality)
  })
  return result
}

/**
 * 映射代理配置到数据对象
 * @param {Object} proxyConfig - 代理配置对象
 * @returns {Object} 映射后的配置对象
 */
function mapProxyConfig(proxyConfig) {
  if (!proxyConfig) return {}
  return {
    // 代理开关
    proxyswitch: getStatus(proxyConfig.switch),
    // 代理主机（敏感信息，需要脱敏）
    proxyhost: getStatus(proxyConfig.host, false, true),
    // 代理端口
    proxyport: getStatus(proxyConfig.port),
    // 代理协议（http/https）
    proxyprotocol: getStatus(proxyConfig.protocol),
    // 代理用户名（敏感信息，需要脱敏）
    proxyusername: getStatus(proxyConfig.auth?.username, false, true),
    // 代理密码（敏感信息，需要脱敏）
    proxypassword: getStatus(proxyConfig.auth?.password, false, true)
  }
}

/**
 * 获取配置项的状态显示HTML
 * @param {*} value - 配置项的值
 * @param {boolean} [isCookie=false] - 是否为Cookie类型（会进行脱敏处理）
 * @param {boolean} [isSensitive=false] - 是否为敏感信息（会进行脱敏处理）
 * @param {boolean} [isQuality=false] - 是否为画质配置（会将数字转换为画质描述）
 * @returns {string} 返回格式化的HTML状态字符串
 */
const getStatus = (value, isCookie = false, isSensitive = false, isQuality = false) => {
  // 定义特殊值的显示映射（null/undefined/boolean/空字符串）
  const statusMap = {
    null: '<div class="cfg-status status-off">未配置</div>',
    undefined: '<div class="cfg-status status-off">未配置</div>',
    true: '<div class="cfg-status">已开启</div>',
    false: '<div class="cfg-status status-off">已关闭</div>',
    '': '<div class="cfg-status status-off">未配置</div>'
  }

  // 如果值在映射表中，直接返回对应的HTML
  if (statusMap[value]) return statusMap[value]

  // 处理数组类型：显示数组长度，空数组显示为关闭状态
  if (Array.isArray(value)) return `<div class="cfg-status${value.length ? '' : ' status-off'}">已配置 ${value.length} 项</div>`

  // 处理数字类型：如果是画质配置，将数字转换为画质描述（如 80 -> 高清 1080P）
  if (typeof value === 'number') return isQuality ? `<div class="cfg-status">${QualityMap[value] || value}</div>` : `<div class="cfg-status">${value}</div>`

  // 处理对象类型：统一显示为“已配置”
  if (typeof value === 'object') return '<div class="cfg-status">已配置</div>'

  // 处理字符串类型
  const str = String(value)

  // Cookie脱敏处理：显示前6位 + *** + 后4位（例：abcdef***wxyz）
  if (isCookie && str.length > 15) {
    const masked = `${str.substring(0, 6)}***${str.substring(str.length - 4)}`
    return `<div class="cfg-status" title="已配置">${masked}</div>`
  }

  // 敏感信息脱敏处理：显示前3位 + ***（例：abc***）
  if (isSensitive && str.length > 3) {
    return `<div class="cfg-status" title="已配置">${str.substring(0, 3)}***</div>`
  }

  // 处理过长字符串：超过20个字符的截断显示，完整内容放在title属性中
  return str.length > 20
    ? `<div class="cfg-status" title="${str}">${str.substring(0, 20)}...</div>`
    : `<div class="cfg-status">${str}</div>`
}

/**
 * 验证并调整数值配置，确保其在允许的范围或值列表内
 * @param {string|number} value - 要验证的值
 * @param {string|number[]} limit - 限制条件，可以是范围字符串（如'1-100'）或固定值数组（如[0,64,80]）
 * @returns {number} 调整后的数值
 */
function checkNumberValue(value, limit) {
  // 如果没有限制，直接返回原值
  if (!limit) return value
  const num = Number(value)

  // 处理数组类型限制（固定值列表）
  // 例：B站画质只能是 [0, 6, 16, 32, 64, 74, 80, 112, 116, 120, 127] 中的一个
  if (Array.isArray(limit)) {
    // 如果输入值在列表中，返回输入值；否则返回列表的第一个值（默认值）
    return limit.includes(num) ? num : limit[0]
  }

  // 处理范围类型限制（最小值-最大值）
  // 例：'1-50' 表示值必须在1到50之间
  const [min, max] = limit.split('-').map(Number)
  if (num < min) return min  // 小于最小值，返回最小值
  if (num > max) return max  // 大于最大值，返回最大值
  return num  // 在范围内，返回原值
}

function removeAllFiles(directory) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(directory)) {
      resolve()
      return
    }
    fs.readdir(directory, (err, files) => {
      if (err) {
        reject(err)
        return
      }
      const deletePromises = files.map(file => {
        const filePath = `${directory}/${file}`
        return new Promise((res, rej) => {
          fs.unlink(filePath, err => err ? rej(err) : res())
        })
      })
      Promise.all(deletePromises).then(resolve).catch(reject)
    })
  })
}
