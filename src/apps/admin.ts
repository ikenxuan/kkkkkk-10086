import { Config, Version, Common } from '@/module/utils/index'
import { bilibiliLogin } from '@/module/platform/bilibili/login'
import { dylogin } from '@/module/platform/douyin/login'
import fs from 'fs'
import type { PluginTask } from 'trss-yunzai'
import type { ConfigName } from '@/types/config'
import type { CommandEvent } from '@/types/message'

/** 「中文配置项名 → yaml 字段名」映射表 */
type CfgKeyMap = Record<string, string>

const APPType: CfgKeyMap = {
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

const DouYinType: CfgKeyMap = {
  抖音解析开关: 'douyintool',
  抖音评论数量: 'numcomments',
  抖音真实评论数量: 'realCommentCount',
  抖音高清语音: 'sendHDrecord',
  抖音自动分辨率: 'autoResolution',
  抖音推送开关: 'push.switch',
  抖音推送解析: 'push.parsedynamic',
  抖音推送日志: 'push.log'
}

const BilibiliType: CfgKeyMap = {
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

const KuaiShouType: CfgKeyMap = {
  快手解析开关: 'kuaishoutool',
  快手解析提示: 'kuaishoutip',
  快手评论数量: 'kuaishounumcomments'
}

const XiaohongshuType: CfgKeyMap = {
  小红书解析开关: 'switch'
}

const UploadType: CfgKeyMap = {
  发送视频base64: 'sendbase64',
  视频上传拦截: 'usefilelimit',
  视频拦截阈值: 'filelimit',
  压缩视频: 'compress',
  触发压缩阈值: 'compresstrigger',
  压缩后的值: 'compressvalue',
  使用文件上传: 'usegroupfile',
  群文件上传阈值: 'groupfilevalue'
}

const RequestType: CfgKeyMap = {
  请求超时时间: 'timeout',
  代理开关: 'proxy.switch'
}

/** 数值型配置项：所属配置文件、yaml 字段名，以及取值限制（范围字符串或候选值列表） */
interface NumberCfgItem {
  type: ConfigName
  key: string
  limit: string | number[]
}

const NumberCfgType: Record<string, NumberCfgItem> = {
  抖音评论数量: { type: 'douyin', key: 'numcomments', limit: '1-50' },
  B站评论数量: { type: 'bilibili', key: 'bilibilinumcomments', limit: '1-20' },
  快手评论数量: { type: 'kuaishou', key: 'kuaishounumcomments', limit: '1-30' },
  小红书评论数量: { type: 'xiaohongshu', key: 'numcomment', limit: '1-50' },
  小红书自动画质大小: { type: 'xiaohongshu', key: 'maxAutoVideoSize', limit: '1-200' },
  渲染精度: { type: 'app', key: 'renderScale', limit: '50-200' },
  优先级: { type: 'app', key: 'priority', limit: '0-10000' },
  API服务端口: { type: 'app', key: 'APIServerPort', limit: '1000-65535' },
  B站画质偏好: { type: 'bilibili', key: 'videoQuality', limit: [0, 6, 16, 32, 64, 74, 80, 112, 116, 120, 127] },
  B站自动画质大小: { type: 'bilibili', key: 'maxAutoVideoSize', limit: '1-200' },
  B站推送画质: { type: 'bilibili', key: 'push.pushVideoQuality', limit: [0, 6, 16, 32, 64, 74, 80, 112, 116, 120, 127] },
  B站推送大小: { type: 'bilibili', key: 'push.pushMaxAutoVideoSize', limit: '1-200' },
  // 上限 4096MB：默认值已放开到 1536MB（1.5GB），而 checkNumberValue 是「静默钳制」而不是报错，
  // 旧的 '5-200' 会让 `#kkk设置视频拦截阈值 1536` 悄悄写成 200，用户看不出来。留到 4096 给群文件通道
  // 一点余量（群文件才扛得住 GB 级，消息内嵌视频段约 100MB 就见顶了）。
  视频拦截阈值: { type: 'upload', key: 'filelimit', limit: '5-4096' },
  // 下面三项维持 '5-200'：触发压缩阈值兼作压缩目标体积、群文件上传阈值是走群文件的分流线，
  // 都不该跟着「视频拦截阈值」一起放大，详见 config/default_config/upload.yaml 里的说明。
  触发压缩阈值: { type: 'upload', key: 'compresstrigger', limit: '5-200' },
  压缩后的值: { type: 'upload', key: 'compressvalue', limit: '5-200' },
  群文件上传阈值: { type: 'upload', key: 'groupfilevalue', limit: '5-200' },
  请求超时时间: { type: 'request', key: 'timeout', limit: '5000-60000' },
  深色主题: { type: 'app', key: 'Theme', limit: '0-2' }
}

const SwitchCfgType: CfgKeyMap = {
  ...APPType,
  ...DouYinType,
  ...BilibiliType,
  ...KuaiShouType,
  ...XiaohongshuType,
  ...UploadType,
  ...RequestType
}

const FileWitch = {
  app: APPType,
  douyin: DouYinType,
  bilibili: BilibiliType,
  kuaishou: KuaiShouType,
  xiaohongshu: XiaohongshuType,
  upload: UploadType,
  request: RequestType
} satisfies Partial<Record<ConfigName, CfgKeyMap>>

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SwitchCfgReg = new RegExp(`^#kkk设置(${Object.keys(SwitchCfgType).map(escapeRegex).join('|')})\\s*(开启|关闭)$`, 'i')
const NumberCfgReg = new RegExp(`^#kkk设置(${Object.keys(NumberCfgType).map(escapeRegex).join('|')})\\s*(\\d+)$`, 'i')

/**
 * 旧实现先用 `Object.keys(values).includes(key)` 找到文件，再从 `SwitchCfgType`（各表的并集）
 * 取字段名。各表的中文键互不重复，因此直接读 `values[key]` 与之等价，
 * 同时能让类型系统看到字段名一定存在。
 */
const findSwitchTarget = (key: string): { file: ConfigName, field: string } | undefined => {
  // Object.entries 会把键退化成 string，这里恢复其字面量类型
  for (const [file, values] of Object.entries(FileWitch) as Array<[ConfigName, CfgKeyMap]>) {
    const field = values[key]
    if (field !== undefined) return { file, field }
  }
  return undefined
}

export class kkkAdmin extends plugin<'message'> {
  constructor () {
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
          reg: /^#?(kkk)?\s*设置小红书ck$/i,
          fnc: 'setxhsck',
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

    const task: PluginTask[] = []
    this.task = task
    if (Config.app.removeCache) {
      task.push({
        cron: '0 0 4 * * *',
        name: '[kkkkkk-10086] 视频缓存自动删除',
        fnc: async () => { await this.deltemp() },
        log: true
      })
    }
  }

  async deltemp (): Promise<boolean> {
    await removeAllFiles(Common.tempDri.video)
      .then(() => logger.warn(Common.tempDri.video + '所有文件已删除'))
      .catch((err: unknown) => logger.error('删除文件时出错:', err))
    return true
  }

  async ConfigSwitch (e: CommandEvent): Promise<boolean> {
    // 命令能派发到这里说明 SwitchCfgReg 已经匹配过，两个捕获组必然存在
    const regRet = SwitchCfgReg.exec(e.msg)
    const key = (regRet?.[1] ?? '').replace(/b站/g, 'B站')
    const target = findSwitchTarget(key)
    if (!target) {
      await e.reply!('配置项不存在')
      return false
    }
    const is = regRet?.[2] === '开启'
    Config.modify(target.file, target.field, is)
    await this.index_Settings(e)
    return true
  }

  async ConfigNumber (e: CommandEvent): Promise<boolean> {
    const regRet = e.msg.match(NumberCfgReg)
    if (!regRet) return false
    const key = (regRet[1] ?? '').replace(/b站/g, 'B站')
    const type = NumberCfgType[key]
    if (!type) {
      await e.reply!('配置项不存在')
      return false
    }
    const number = checkNumberValue(regRet[2], type.limit)
    Config.modify(type.type, type.key, number)
    await this.index_Settings(e)
    return true
  }

  async index_Settings (e: CommandEvent): Promise<boolean> {
    await e.reply!([
      'KKK 配置页面已迁移到锅巴 Web 面板。',
      '请安装 guoba-plugin 与 guoba-plugin-web，然后在「插件管理」中选择 kkkkkk-10086。',
      '现有 #kkk设置<配置项><开启/关闭或数值> 命令仍可继续使用。'
    ].join('\n'))
    return true
  }

  async Blogin (e: CommandEvent): Promise<boolean> {
    // 同 dylogin：bilibiliLogin 只用到 reply、bot.recallMsg 与取头像那两个身份字段，
    // 且把 reply 声明为必填；命令事件上必然带 reply
    await bilibiliLogin(e as Parameters<typeof bilibiliLogin>[0])
    return true
  }

  async dylogin (e: CommandEvent): Promise<boolean> {
    // dylogin 只用到 reply、bot.recallMsg 与取头像那两个身份字段，而其形参把 reply
    // 声明为必填；命令事件上必然带 reply
    await dylogin(e as Parameters<typeof dylogin>[0], {
      // 等待秒数由 dylogin 给（它把同一个数字写进了提示文案），这里不能自己定一个别的
      waitForCode: async (prompt, timeoutSeconds) => {
        await this.reply(prompt, true)
        const ctx = await this.awaitContext(false, timeoutSeconds, '验证码输入超时，登录失败')
        return ctx?.msg || ''
      }
    })
    return true
  }

  async setdyck (): Promise<boolean> {
    this.setContext('savedyck')
    this.reply('请在120秒内发送抖音ck\n教程：https://ikenxuan.github.io/kkkkkk-10086/docs/intro/other#%E9%85%8D%E7%BD%AE%E4%B8%8D%E5%90%8C%E5%B9%B3%E5%8F%B0%E7%9A%84-cookies', true)
    return true
  }

  async savedyck (): Promise<boolean> {
    Config.modify('cookies', 'douyin', String(this.e.msg))
    this.reply('设置成功！')
    this.finish('savedyck')
    return true
  }

  async setbilick (): Promise<boolean> {
    this.setContext('savebilick')
    this.reply('请在120秒内发送B站ck\n教程：https://ikenxuan.github.io/kkkkkk-10086/docs/intro/other#%E9%85%8D%E7%BD%AE%E4%B8%8D%E5%90%8C%E5%B9%B3%E5%8F%B0%E7%9A%84-cookies')
    return true
  }

  async savebilick (): Promise<boolean> {
    Config.modify('cookies', 'bilibili', String(this.e.msg))
    this.reply('设置成功！')
    this.finish('savebilick')
    return true
  }

  async setksck (): Promise<boolean> {
    this.setContext('saveksck')
    const img = `${Version}/plugins/kkkkkk-10086/resources/image/pic1.png`
    this.reply(['请发送快手ck\n', '教程：https://docs.qq.com/doc/DRExRWUh1a3l4bnlI\n', segment.image(img)])
    return true
  }

  async saveksck (): Promise<boolean> {
    Config.modify('cookies', 'kuaishou', String(this.e.msg))
    this.reply('设置成功！')
    this.finish('saveksck')
    return true
  }

  async setxhsck (): Promise<boolean> {
    this.setContext('savexhsck')
    this.reply('请在120秒内发送小红书ck')
    return true
  }

  async savexhsck (): Promise<boolean> {
    Config.modify('cookies', 'xiaohongshu', String(this.e.msg))
    this.reply('设置成功！')
    this.finish('savexhsck')
    return true
  }
}

/**
 * 验证并调整数值配置，确保其在允许的范围或值列表内
 * @param value - 要验证的值
 * @param limit - 限制条件，可以是范围字符串（如'1-100'）或固定值数组（如[0,64,80]）
 * @returns 调整后的数值。`limit` 为空时原样返回入参，与旧实现一致
 */
function checkNumberValue (value: string | undefined, limit: string | number[]): string | number | undefined {
  if (!limit) return value
  const num = Number(value)

  // 例：B站画质只能是 [0, 6, 16, 32, 64, 74, 80, 112, 116, 120, 127] 中的一个
  if (Array.isArray(limit)) {
    return limit.includes(num) ? num : limit[0]
  }

  // 例：'1-50' 表示值必须在1到50之间
  // 拆分结果不足两段时 min/max 为 undefined，与之比较恒为 false，行为同旧实现
  const [min, max] = limit.split('-').map(Number)
  if (min !== undefined && num < min) return min
  if (max !== undefined && num > max) return max
  return num
}

function removeAllFiles (directory: string): Promise<void> {
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
        return new Promise<void>((resolve, reject) => {
          fs.unlink(filePath, err => err ? reject(err) : resolve())
        })
      })
      Promise.all(deletePromises).then(() => resolve()).catch(reject)
    })
  })
}
