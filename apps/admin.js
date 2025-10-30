import { Config, Render, Version, Common } from '../module/utils/index.js'
import { bilibiliLogin } from '../module/platform/bilibili/login.js'
import { dylogin } from '../module/platform/douyin/login.js'
import path from 'path'
import fs from 'fs'

const APPType = {
  缓存删除: 'removeCache',
  视频解析: 'videotool',
  默认解析: 'defaulttool',
  转发: 'sendforwardmsg',
  API服务: 'APIServer',
  API服务日志: 'APIServerLog'
}

const UploadType = {
  上传拦截: 'usefilelimit'
}

const DouYinType = {
  抖音评论: 'comments',
  抖音推送: 'douyinpush',
  抖音评论图: 'commentsimg',
  抖音推送日志: 'douyinpushlog',
  抖音推送表达式: 'douyinpushcron',
  抖音解析提示: 'douyintip',
  抖音解析: 'douyintool',
  抖音高清语音: 'sendHDrecord',
  抖音推送解析: 'senddynamicwork'
}

const BilibiliType = {
  设置B站评论: 'bilibilicommentsimg',
  B站推送: 'bilibilipush',
  B站推送日志: 'bilibilipushlog',
  B站推送表达式: 'bilibilipushcron',
  B站解析提示: 'bilibilitip',
  B站解析: 'bilibilitool',
  B站推送解析: 'senddynamicvideo',
  B站内容优先: 'videopriority'
}

const KuaiShouType = {
  快手解析: 'kuaishoutool',
  快手解析提示: 'kuaishoutip'
}

/** 数字相关设置 */
const NumberCfgType = {
  抖音评论数量: { type: 'douyin', key: 'numcomments', limit: '0-50' },
  B站评论数量: { type: 'bilibili', key: 'bilibilinumcomments', limit: '0-20' },
  抖音推送设置权限: { type: 'douyin', key: 'douyinpushGroup', limit: '0-2' },
  B站推送设置权限: { type: 'bilibili', key: 'bilibilipushGroup', limit: '0-2' },
  渲染精度: { type: 'app', key: 'renderScale', limit: '50-200' },
  优先级: { type: 'app', key: 'priority', limit: '0-114514' },
  上传拦截阈值: { type: 'upload', key: 'filelimit', limit: '5-114514' },
  快手评论数量: { type: 'kuaishou', key: 'kuaishounumcomments', limit: '0-30' }
}

/** 开关相关设置 */
const SwitchCfgType = {
  ...APPType,
  ...UploadType,
  ...DouYinType,
  ...BilibiliType,
  ...KuaiShouType
}

const FileWitch = {
  app: APPType,
  upload: UploadType,
  douyin: DouYinType,
  bilibili: BilibiliType,
  kuaishou: KuaiShouType
}

/** 
 * 映射平铺键到嵌套键的关系
 * 用于同步修改配置时更新对应的嵌套键
 * 
 * 注意：虽然 douyin 和 bilibili 的键映射到相同的嵌套路径（如 'push.switch'），
 * 但它们实际修改的是不同的配置文件，因此不会产生冲突：
 * - douyinpush -> douyin.yaml 中的 push.switch
 * - bilibilipush -> bilibili.yaml 中的 push.switch
 */
const KeyMapping = {
  douyinpush: 'push.switch',
  douyinpushlog: 'push.log',
  douyinpushcron: 'push.cron',
  douyinpushGroup: 'push.permission',
  senddynamicwork: 'push.parsedynamic',
  bilibilipush: 'push.switch',
  bilibilipushlog: 'push.log',
  bilibilipushcron: 'push.cron',
  bilibilipushGroup: 'push.permission',
  senddynamicvideo: 'push.parsedynamic'
}

const SwitchCfgReg = new RegExp(`^#kkk设置(${Object.keys(SwitchCfgType).join('|')})(开启|关闭)$`)
const NumberCfgReg = new RegExp(`^#kkk设置(${Object.keys(NumberCfgType).join('|')})(\\d+)$`)
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
          reg: /^#?(kkk)?s*设置抖音ck$/i,
          fnc: 'setdyck',
          permission: 'master'
        },
        {
          reg: /^#?(kkk)?s*设置s*(B站)ck$/i,
          fnc: 'setbilick',
          permission: 'master'
        },
        {
          reg: /^#?(kkk)?s*设置快手ck$/i,
          fnc: 'setksck',
          permission: 'master'
        },
        {
          reg: /^#?(kkk)?\s*B站\s*(扫码)?\s*登录$/i,
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
    this.task = []
    if (Config.app.removeCache) {
      this.task.push({
        cron: '0 0 4 * * *',
        name: '[kkkkkk-10086] 视频缓存自动删除',
        fnc: () => this.deltemp(),
        log: true
      })
    }
  }

  async deltemp() {
    removeAllFiles(Common.tempDri.video)
      .then(() => logger.warn(Common.tempDri.video + '所有文件已删除'))
      .catch((err) => logger.error('删除文件时出错:', err))
  }

  /** 修改开关设置 */
  async ConfigSwitch(e) {
    // 解析消息
    const regRet = SwitchCfgReg.exec(e.msg)
    const key = regRet[1]
    const file = Object.entries(FileWitch)
      .find(([, values]) => Object.keys(values).includes(key))[0]
    const is = regRet[2] == '开启'
    const _key = SwitchCfgType[key]
    const resolvedKey = _key?.key ?? _key
    
    // 修改配置键
    Config.modify(file, resolvedKey, is)
    
    // 如果存在嵌套键映射，同时更新嵌套键
    const nestedKey = KeyMapping[resolvedKey]
    if (nestedKey) {
      Config.modify(file, nestedKey, is)
    }
    
    // 渲染图片
    await this.index_Settings(e)
    return true
  }

  // 修改数字设置
  async ConfigNumber(e) {
    const regRet = e.msg.match(NumberCfgReg)
    const type = NumberCfgType[regRet[1]]
    const number = checkNumberValue(regRet[2], type.limit)
    if (type.key === 'douyinpushGroup' || type.key === 'bilibilipushGroup') {
      const groupMapping = { 0: 'all', 1: 'admin', 2: 'owner', 3: 'master' }

      if (groupMapping.hasOwnProperty(number)) {
        Config.modify(type.type, type.key, groupMapping[number])
        // 同时更新嵌套键
        const nestedKey = KeyMapping[type.key]
        if (nestedKey) {
          Config.modify(type.type, nestedKey, groupMapping[number])
        }
      } else {
        Config.modify(type.type, type.key, groupMapping['3'])
        // 同时更新嵌套键
        const nestedKey = KeyMapping[type.key]
        if (nestedKey) {
          Config.modify(type.type, nestedKey, groupMapping['3'])
        }
      }
    } else {
      Config.modify(type.type, type.key, number)
      // 如果存在嵌套键映射，同时更新嵌套键
      const nestedKey = KeyMapping[type.key]
      if (nestedKey) {
        Config.modify(type.type, nestedKey, number)
      }
    }
    await this.index_Settings(e)
    return true
  }

  // 渲染发送图片
  async index_Settings(e) {
    const data = {}
    let _cfg = await Config.All()
    _cfg = (function () {
      _cfg.cookies = _cfg.cookies || {}
      const { douyin, bilibili, kuaishou } = _cfg.cookies
      _cfg.cookies.b = bilibili
      _cfg.cookies.d = douyin
      _cfg.cookies.k = kuaishou
      delete _cfg.cookies.bilibili
      delete _cfg.cookies.douyin
      delete _cfg.cookies.kuaishou
      return _cfg
    })()
    for (const item in _cfg) {
      for (const key in _cfg[item]) {
        data[key] = getStatus(_cfg[item][key])
      }
    }

    const img = await Render('admin/index', { data })
    await e.reply(img)
    return true
  }

  async Blogin(e) {
    await bilibiliLogin(e)
    return true
  }

  async dylogin(e) {
    await dylogin(e)
    return true
  }

  async setdyck() {
    this.setContext('savedyck')
    await this.reply('请发在120秒内送抖音ck\n教程：https://ikenxuan.github.io/kkkkkk-10086/docs/intro/other#%E9%85%8D%E7%BD%AE%E4%B8%8D%E5%90%8C%E5%B9%B3%E5%8F%B0%E7%9A%84-cookies\n', true)
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
    await this.reply('请发在120秒内送B站ck\n教程：https://ikenxuan.github.io/kkkkkk-10086/docs/intro/other#%E9%85%8D%E7%BD%AE%E4%B8%8D%E5%90%8C%E5%B9%B3%E5%8F%B0%E7%9A%84-cookies\n')
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
    await this.reply(['请发送快手ck\n', '教程：https://docs.qq.com/doc/DRExRWUh1a3l4bnlI\n', segment.image(img)])
    return true
  }

  async saveksck() {
    Config.modify('cookies', 'kuaishou', String(this.e.msg))
    this.reply('设置成功！')
    this.finish('saveksck')
    return true
  }
}

const getStatus = function (rote) {
  switch (true) {
    case Array.isArray(rote):
      if (rote.length === 0) return `<div class="cfg-status status-off" >已配置 ${rote.length} 项</div>`
      else return `<div class="cfg-status " >已配置 ${rote.length} 项</div>`
    case rote === true:
      return '<div class="cfg-status" >已开启</div>'
    case rote === false:
      return '<div class="cfg-status status-off">已关闭</div>'
    default:
      if (rote == null || rote === '') return '<div class="cfg-status status-off">未配置</div>'
      else return `<div class="cfg-status">${String(rote).length > 10 ? String(rote).substring(0, 10) + '...' : String(rote)}</div>`
  }
}

function checkNumberValue(value, limit) {
  // 检查是否存在限制条件
  if (!limit) {
    return value
  }
  // 解析限制条件
  const [symbol, limitValue] = limit.match(/^([<>])?(.+)$/).slice(1)
  const parsedLimitValue = parseFloat(limitValue)

  // 检查比较限制条件
  if ((symbol === '<' && value > parsedLimitValue) || (symbol === '>' && value < parsedLimitValue)) {
    return parsedLimitValue
  }

  // 检查范围限制条件
  if (!isNaN(value)) {
    const [lowerLimit, upperLimit] = limit.split('-').map(parseFloat)
    const clampedValue = Math.min(Math.max(value, lowerLimit || -Infinity), upperLimit || Infinity)
    return clampedValue
  }

  // 如果不符合以上任何条件，则返回原值
  return parseFloat(value)
}

async function removeAllFiles(dir) {
  const files = await fs.promises.readdir(dir)
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stats = await fs.promises.stat(filePath)
    if (stats.isDirectory()) {
      // 如果是目录，则递归调用removeAllFiles
      await removeAllFiles(filePath)
      await fs.promises.rmdir(filePath) // 删除空目录
    } else if (stats.isFile()) {
      // 如果是文件，则直接删除
      await fs.promises.unlink(filePath)
    }
  }
}
