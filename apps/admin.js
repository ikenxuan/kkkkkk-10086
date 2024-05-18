import { Config, Render, _path } from '#modules'
import { BiLogin } from '#bilibili'

const APPType = {
  缓存删除: 'rmmp4',
  视频解析: 'videotool',
  默认解析: 'defaulttool',
  转发: 'sendforwardmsg',
}

const DouYinType = {
  抖音评论: 'comments',
  抖音评论图: 'commentsimg',
  抖音推送: 'douyinpush',
  抖音推送日志: 'douyinpushlog',
  抖音推送表达式: 'douyinpushcron',
  抖音解析提示: 'douyintip',
}

const BilibiliType = {
  B站评论图: 'bilibilicommentsimg',
  B站推送: 'bilibilipush',
  B站推送日志: 'bilibilipushlog',
  B站推送表达式: 'bilibilipushcron',
  B站解析提示: 'bilibilitip',
}
const NumberCfgType = {
  抖音评论数量: { key: 'numcomments', limit: '0-50' },
  B站评论数量: { key: 'bilibilinumcomments', limit: '0-20' },
  抖音推送设置权限: { key: 'douyinpushGroup', limit: '0-2' },
  B站推送设置权限: { key: 'bilibilipushGroup', limit: '0-2' },
  渲染精度: { key: 'renderScale', limit: '50-200' },
}

/** 分开开关和数字 */
const SwitchCfgType = {
  ...APPType,
  ...DouYinType,
  ...BilibiliType,
}

const SwitchCfgReg = new RegExp(`^#kkk设置(${Object.keys(SwitchCfgType).join('|')})(开启|关闭)$`)
const NumberCfgReg = new RegExp(`^#kkk设置(${Object.keys(NumberCfgType).join('|')})(\\d+)$`)
export class Admin extends plugin {
  constructor() {
    super({
      name: 'kkkkkk-10086-设置',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: SwitchCfgReg,
          fnc: 'ConfigSwitch',
          permission: 'master',
        },
        {
          reg: NumberCfgReg,
          fnc: 'ConfigNumber',
          permission: 'master',
        },
        {
          reg: /^#kkk设置$/,
          fnc: 'index_Settings',
          permission: 'master',
        },
        {
          reg: /^#?(kkk)?s*设置抖音ck$/i,
          fnc: 'setdyck',
          permission: 'master',
        },
        {
          reg: /^#?(kkk)?s*设置s*(B站)ck$/i,
          fnc: 'setbilick',
          permission: 'master',
        },
        {
          reg: /^#?(kkk)?\s*B站\s*(扫码)?\s*登录$/i,
          fnc: 'Blogin',
          permission: 'master',
        },
      ],
    })
  }

  async ConfigSwitch(e) {
    // 解析消息
    let regRet = SwitchCfgReg.exec(e.msg)
    let key = regRet[1]
    let is = regRet[2] == '开启'
    key !== undefined ? (Config[SwitchCfgType[key]] = is) : null
    // 渲染图片
    this.index_Settings(e)
  }

  // 修改数字设置
  async ConfigNumber(e) {
    let regRet = e.msg.match(NumberCfgReg)
    let type = NumberCfgType[regRet[1]]
    let number = checkNumberValue(regRet[2], type.limit)
    if (type.key === 'douyinpushGroup' || type.key === 'bilibilipushGroup') {
      const groupMapping = { 0: 'all', 1: 'admin', 2: 'owner', 3: 'master' }
      if (groupMapping.hasOwnProperty(number)) {
        Config[type.key] = groupMapping[number]
      } else {
        Config[type.key] = groupMapping['3']
      }
    } else {
      Config[type.key] = number
    }
    this.index_Settings(e)
  }

  // 渲染发送图片
  async index_Settings(e) {
    let data = {}
    let _cfg = Config.ALLcfg
    for (let key in _cfg) {
      data[key] = getStatus(_cfg[key])
    }
    return await Render.render('html/admin/index', { data }, { e, scale: 1.4 })
  }

  async Blogin(e) {
    await new BiLogin(e).Login()
  }

  async setdyck() {
    this.setContext('savedyck')
    const img = `${_path}/plugins/kkkkkk-10086/resources/pic/pic1.png`
    await this.reply(['请发送抖音ck\n', '教程：https://docs.qq.com/doc/DRExRWUh1a3l4bnlI\n', segment.image(img)], true)
    return false
  }

  async savedyck() {
    Config.ck = String(this.e.msg)
    this.reply('设置成功！')
    this.finish('savedyck')
  }

  async setbilick() {
    this.setContext('savebilick')
    const img = `${_path}/plugins/kkkkkk-10086/resources/pic/pic1.png`
    await this.reply(['请发送B站ck\n', '教程：https://docs.qq.com/doc/DRExRWUh1a3l4bnlI\n', segment.image(img)], true)
    return false
  }

  async savebilick() {
    Config.bilibilick = String(this.e.msg)
    this.reply('设置成功！')
    this.finish('savebilick')
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
