import fs from 'fs'

const configPath = process.cwd() + '/plugins/kkkkkk-10086/config/config.json'

const defaultConfig = {
  rmmp4: true,
  videotool: true,
  comments: true,
  defaulttool: true,
  numcomments: 20,
  ck: '',
  commentsimg: true,
  newui: true,
  douyinpush: false,
  douyinpushlist: [],
  douyinpushlog: true,
  douyinpushcron: '*/10 * * * *',
}
let config = {}

function getConfig() {
  const content = fs.readFileSync(configPath)
  return JSON.parse(content)
}

config = Object.assign({}, defaultConfig, config)
if (fs.existsSync(configPath)) {
  const fullPath = fs.realpathSync(configPath)
  const data = fs.readFileSync(fullPath)
  if (data) {
    try {
      config = JSON.parse(data)
    } catch (e) {
      logger.error('kkkkkk-10086读取配置文件出错', e)
    }
  }
}
export const Config = new Proxy(config, {
  get(target, prop) {
    const config = getConfig()
    if (prop in config) {
      return config[prop]
    } else {
      return defaultConfig[prop]
    }
  },

  set(target, property, value) {
    if (typeof value === 'number') {
      value = Number(value)
    }
    target[property] = value

    const merged = Object.assign({}, defaultConfig, target)
    try {
      fs.writeFileSync(configPath, JSON.stringify(merged, null, 2))
      logger.info('[修改配置文件][kkkkkk-10086][config]')
    } catch (err) {
      logger.error(err)
      return false
    }
    return true
  },
})
