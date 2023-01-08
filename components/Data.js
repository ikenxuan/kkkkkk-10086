import lodash from 'lodash'
import fs from 'fs'
const _path = process.cwd()
const plugin = 'kkkkkk-10086'
const getRoot = (root = '') => {
  if (root === 'root' || root === 'yunzai') {
    root = `${_path}/`
  } else if (!root) {
    root = `${_path}/plugins/${plugin}/`
  }
  return root
}
let Data = {
  createDir(path = '', root = '', includeFile = false) {
    root = getRoot(root)
    let pathList = path.split('/')
    let nowPath = root
    pathList.forEach((name, idx) => {
      name = name.trim()
      if (!includeFile && idx <= pathList.length - 1) {
        nowPath += name + '/'
        if (name) {
          if (!fs.existsSync(nowPath)) {
            fs.mkdirSync(nowPath)
          }
        }
      }
    })
  },
  readJSON(file = '', root = '') {
    root = getRoot(root)
    if (fs.existsSync(`${root}/${file}`)) {
      try {
        return JSON.parse(fs.readFileSync(`${root}/${file}`, 'utf8'))
      } catch (e) {
        console.log(e)
      }
    }
    return {}
  },
  writeJSON(file, data, space = '\t', root = '') {
    // 检查并创建目录
    Data.createDir(file, root, true)
    root = getRoot(root)
    delete data._res
    return fs.writeFileSync(`${root}/${file}`, JSON.stringify(data, null, space))
  },
  async getCacheJSON(key) {
    try {
      let txt = await redis.get(key)
      if (txt) {
        return JSON.parse(txt)
      }
    } catch (e) {
      console.log(e)
    }
    return {}
  },
  async setCacheJSON(key, data, EX = 3600 * 24 * 90) {
    await redis.set(key, JSON.stringify(data), { EX })
  },
  async importModule(file, root = '') {
    root = getRoot(root)
    if (!/\.js$/.test(file)) {
      file = file + '.js'
    }
    if (fs.existsSync(`${root}/${file}`)) {
      try {
        let data = await import(`file://${root}/${file}?t=${new Date() * 1}`)
        return data || {}
      } catch (e) {
        console.log(e)
      }
    }
    return {}
  },
  async importDefault(file, root) {
    let ret = await Data.importModule(file, root)
    return ret.default || {}
  },
  async import(name) {
    return await Data.importModule(`components/optional-lib/${name}.js`)
  },
  async importCfg(key) {
    let sysCfg = await Data.importModule(`config/model/${key}_model.js`)
    let diyCfg = await Data.importModule(`config/${key}.js`)
    if (diyCfg.isSys) {
      console.error(`kkkkkk-10086: config/${key}.js`)
      console.error(`config/${key}_default.js为config/${key}.js`)
      diyCfg = {}
    }
    return {
      sysCfg,
      diyCfg
    }
  },
  getData(target, keyList = '', cfg = {}) {
    target = target || {}
    let defaultData = cfg.defaultData || {}
    let ret = {}
    if (typeof (keyList) === 'string') {
      keyList = keyList.split(',')
    }
    lodash.forEach(keyList, (keyCfg) => {
      let _keyCfg = keyCfg.split(':')
      let keyTo = _keyCfg[0].trim()
      let keyFrom = (_keyCfg[1] || _keyCfg[0]).trim()
      let keyRet = keyTo
      if (cfg.lowerFirstKey) {
        keyRet = lodash.lowerFirst(keyRet)
      }
      if (cfg.keyPrefix) {
        keyRet = cfg.keyPrefix + keyRet
      }
      ret[keyRet] = Data.getVal(target, keyFrom, defaultData[keyTo], cfg)
    })
    return ret
  },
  getVal(target, keyFrom, defaultValue) {
    return lodash.get(target, keyFrom, defaultValue)
  },
  async asyncPool(poolLimit, array, iteratorFn) {
    const ret = []
    const executing = []
    for (const item of array) {
      const p = Promise.resolve().then(() => iteratorFn(item, array))
      ret.push(p)
      if (poolLimit <= array.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1))
        executing.push(e)
        if (executing.length >= poolLimit) {
          await Promise.race(executing)
        }
      }
    }
    return Promise.all(ret)
  },
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  },
  def() {
    for (let idx in arguments) {
      if (!lodash.isUndefined(arguments[idx])) {
        return arguments[idx]
      }
    }
  },
  eachStr: (arr, fn) => {
    if (lodash.isString(arr)) {
      arr = arr.replace(/\s*(;|；|、|，)\s*/, ',')
      arr = arr.split(',')
    } else if (lodash.isNumber(arr)) {
      arr = [arr.toString()]
    }
    lodash.forEach(arr, (str, idx) => {
      if (!lodash.isUndefined(str)) {
        fn(str.trim ? str.trim() : str, idx)
      }
    })
  },
  regRet(reg, txt, idx) {
    if (reg && txt) {
      let ret = reg.exec(txt)
      if (ret && ret[idx]) {
        return ret[idx]
      }
    }
    return false
  }
}
export default Data