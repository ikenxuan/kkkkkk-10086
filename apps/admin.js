import { Config } from '#modules'
import { BiLogin, refresh_token } from '#bilibili'

let _path = process.cwd()

async function updateConfig(key, value, e) {
  Config[key] = value
  e.reply('设置成功！')
}

function getValue(msg) {
  if (msg.includes('开启')) return true
  if (msg.includes('关闭')) return false
}

export class admin extends plugin {
  constructor(e) {
    super({
      name: 'kkkkkk-10086-管理',
      dsc: 'admin',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: /^#?(kkk)?s*设置$/,
          fnc: 'set',
          permission: 'master',
        },
        {
          reg: /^#?(kkk)?s*设置(视频解析|解析)s*(开启|关闭)$/,
          fnc: 'tools',
          permission: 'master',
        },
        {
          reg: /^#?(kkk)?s*设置(默认视频解析|默认解析)s*(开启|关闭)$/,
          fnc: 'defaulttool',
          permission: 'master',
        },
        {
          reg: /^#?(kkk)?s*设置(评论|评论解析)s*(开启|关闭)$/,
          fnc: 'comments',
          permission: 'master',
        },
        {
          reg: /^#?(kkk)?s*设置缓存删除s*(开启|关闭)$/,
          fnc: 'temp',
          permission: 'master',
        },
        {
          reg: /^#?(kkk)?s*设置抖音ck$/i,
          fnc: 'setdyck',
          permission: 'master',
        },
        {
          reg: /^#?(kkk)?s*设置评论图片s*(开启|关闭)$/,
          fnc: 'commentsimg',
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
    // this.task = {
    //   cron: '0 1 * * *',
    //   name: '刷新B站ck',
    //   fnc: () => this.refresh_token(),
    //   log: true,
    // }
  }

  async refresh_token() {
    await refresh_token()
  }

  async Blogin(e) {
    await new BiLogin(e).Login()
  }

  async set(e) {
    let text = []
    for (let i = 0; i < this.rule.length; i++) {
      let reg = this.rule[i].reg + '\n\n'
      text.push(reg)
    }
    e.reply(text)
  }

  async defaulttool(e) {
    const value = getValue(e.msg)
    await updateConfig('defaulttool', value, e)
    e.reply('重启以应用更新', true)
  }

  async tools(e) {
    const value = getValue(e.msg)
    await updateConfig('videotool', value, e)
    e.reply('重启以应用更新', true)
  }

  async comments(e) {
    const value = getValue(e.msg)
    await updateConfig('comments', value, e)
  }

  async temp(e) {
    const value = getValue(e.msg)
    await updateConfig('rmmp4', value, e)
  }

  async setbilick(e) {
    this.setContext('savebilick')
    const img = `${_path}/plugins/kkkkkk-10086/resources/pic/pic1.png`
    await this.reply(['请发送B站ck\n', '教程：https://docs.qq.com/doc/DRExRWUh1a3l4bnlI\n', segment.image(img)], true)
    return false
  }

  async savebilick() {
    const value = this.e.msg
    await updateConfig('bilibilick', value, this.e)
    this.finish('savebilick')
  }

  async commentsimg(e) {
    const value = getValue(e.msg)
    await updateConfig('commentsimg', value, e)
  }

  async setdyck(e) {
    this.setContext('savedyck')
    const img = `${_path}/plugins/kkkkkk-10086/resources/pic/pic1.png`
    await this.reply(['请发送抖音ck\n', '教程：https://docs.qq.com/doc/DRExRWUh1a3l4bnlI\n', segment.image(img)], true)
    return false
  }
  async savedyck() {
    const value = this.e.msg
    await updateConfig('ck', value, this.e)
    this.finish('savedyck')
  }
}
