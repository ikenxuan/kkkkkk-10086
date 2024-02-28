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
  douyinpushlist: {},
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
      if (prop === 'douyinpushlist') {
        const douyinpushlist = []
        const groupMap = {}
        for (const groupId in config.douyinpushlist) {
          const secIds = config.douyinpushlist[groupId]
          if (Array.isArray(secIds)) {
            for (const secId of secIds) {
              if (!groupMap[secId]) {
                groupMap[secId] = []
              }
              groupMap[secId].push(groupId)
            }
          } else {
            if (!groupMap[secIds]) {
              groupMap[secIds] = []
            }
            groupMap[secIds].push(groupId)
          }
        }
        for (const secId in groupMap) {
          if (groupMap[secId].length === 1) {
            douyinpushlist.push({ group_id: groupMap[secId][0], sec_uid: secId })
          } else {
            douyinpushlist.push({ group_id: groupMap[secId], sec_uid: secId })
          }
        }
        return douyinpushlist
      }
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
    if (property === 'douyinpushlist' && Array.isArray(value)) {
      target[property] = {}
      for (const item of value) {
        const groupIds = item.group_id
        const secUid = item.sec_uid
        if (Array.isArray(groupIds)) {
          for (const id of groupIds) {
            if (!target[property][id]) {
              target[property][id] = []
            }
            if (secUid && !target[property][id].includes(secUid)) {
              target[property][id].push(secUid)
            }
          }
        }
      }
    } else {
      target[property] = value
    }
    const merged = Object.assign({}, defaultConfig, target)
    try {
      fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), {
        flag: 'w',
      })
      logger.info('[修改配置文件][kkkkkk-10086][config]')
    } catch (err) {
      logger.error(err)
      return false
    }
    return true
  },
})
