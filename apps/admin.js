import { Config, Render, Version } from '#components'
import { plugin, segment } from '#lib'
import { BiLogin } from '#bilibili'
import fs from 'fs'
import path from 'path'

const APPType = {
  缓存删除: 'rmmp4',
  视频解析: 'videotool',
  默认解析: 'defaulttool',
  转发: 'sendforwardmsg',
  上传限制: 'usefilelimit'
}

const DouYinType = {
  抖音评论: 'comments',
  抖音推送: 'douyinpush',
  抖音评论图: 'commentsimg',
  抖音推送日志: 'douyinpushlog',
  抖音推送表达式: 'douyinpushcron',
  抖音解析提示: 'douyintip',
  抖音解析: 'douyintool',
  抖音高清语音: 'sendHDrecord'
}

const BilibiliType = {
  B站评论图: 'bilibilicommentsimg',
  B站推送: 'bilibilipush',
  B站推送日志: 'bilibilipushlog',
  B站推送表达式: 'bilibilipushcron',
  B站解析提示: 'bilibilitip',
  B站解析: 'bilibilitool'
}
const NumberCfgType = {
  抖音评论数量: { key: 'numcomments', limit: '0-50' },
  B站评论数量: { key: 'bilibilinumcomments', limit: '0-20' },
  抖音推送设置权限: { key: 'douyinpushGroup', limit: '0-2' },
  B站推送设置权限: { key: 'bilibilipushGroup', limit: '0-2' },
  渲染精度: { key: 'renderScale', limit: '50-200' },
  优先级: { key: 'priority', limit: '0-114514' },
  限制: { key: 'filelimit', limit: '5-114514' }
}

/** 分开开关和数字 */
const SwitchCfgType = {
  ...APPType,
  ...DouYinType,
  ...BilibiliType
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
          reg: /^#?(kkk)?\s*B站\s*(扫码)?\s*登录$/i,
          fnc: 'Blogin',
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
    if (Config.rmmp4) {
      this.task.push({
        cron: '0 0 4 * * *',
        name: '[kkkkkk-10086] 视频缓存自动删除',
        fnc: () => this.deltemp()
      })
    }
  }

  async deltemp () {
    removeAllFiles(process.cwd() + '/resources/kkkdownload/video/')
      .then(() => this.reply('/resources/kkkdownload/video/' + '所有文件已删除'))
      .catch((err) => console.error('删除文件时出错:', err))
  }

  async ConfigSwitch (e) {
    // 解析消息
    const regRet = SwitchCfgReg.exec(e.msg)
    const key = regRet[1]
    const is = regRet[2] == '开启'
    key && (Config[SwitchCfgType[key]] = is)
    // 渲染图片
    await this.index_Settings(e)
    return false
  }

  // 修改数字设置
  async ConfigNumber (e) {
    const regRet = e.msg.match(NumberCfgReg)
    const type = NumberCfgType[regRet[1]]
    const number = checkNumberValue(regRet[2], type.limit)
    if (type.key === 'douyinpushGroup' || type.key === 'bilibilipushGroup') {
      const groupMapping = { 0: 'all', 1: 'admin', 2: 'owner', 3: 'master' }
      // eslint-disable-next-line no-prototype-builtins
      if (groupMapping.hasOwnProperty(number)) {
        Config[type.key] = groupMapping[number]
      } else {
        Config[type.key] = groupMapping['3']
      }
    } else {
      Config[type.key] = number
    }
    await this.index_Settings(e)
    return false
  }

  // 渲染发送图片
  async index_Settings (e) {
    const data = {}
    const _cfg = Config.ALLcfg
    for (const key in _cfg) {
      data[key] = getStatus(_cfg[key])
    }
    const img = await Render.render('html/admin/index', { data })
    await e.reply(img)
    return false
  }

  async Blogin (e) {
    await new BiLogin(e).Login()
    return false
  }

  async setdyck () {
    this.setContext('savedyck')
    const _path = ''
    const img = `${_path}/plugins/kkkkkk-10086/resources/pic/pic1.png`
    await this.reply(['请发送抖音ck\n', '教程：https://docs.qq.com/doc/DRExRWUh1a3l4bnlI\n', segment.image(img)], true)
    return false
  }

  async savedyck () {
    Config.ck = String(this.e.msg)
    this.reply('设置成功！')
    this.finish('savedyck')
    return false
  }

  async setbilick () {
    this.setContext('savebilick')
    const img = `${Version}/plugins/kkkkkk-10086/resources/pic/pic1.png`
    await this.reply(['请发送B站ck\n', '教程：https://docs.qq.com/doc/DRExRWUh1a3l4bnlI\n', segment.image(img)], true)
    return false
  }

  async savebilick () {
    Config.bilibilick = String(this.e.msg)
    this.reply('设置成功！')
    this.finish('savebilick')
    return false
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

function checkNumberValue (value, limit) {
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
async function removeAllFiles (dir) {
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
