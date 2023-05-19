import fs from 'fs'
import lodash from 'lodash'

config = Object.assign({}, config)
const _path = process.cwd()
let config = {}
fs.existsSync(`${_path}/plugins/kkkkkk-10086/config/config.json`)
const fullPath = fs.realpathSync(`${_path}/plugins/kkkkkk-10086/config/config.json`)
const data = fs.readFileSync(fullPath)
if (data) {
    try {
        config = JSON.parse(data)
    } catch (e) {
        logger.error('kkkkkk-10086插件读取配置文件出错', e)
    }
}

export const Config = new Proxy(config, {
    set(target, property, value) {
        target[property] = value
        const change = lodash.transform(target, function (result, value, key) {
            if (!lodash.isEqual(value)) {
                result[key] = value
            }
        })
        try {
            fs.writeFileSync(`${_path}/plugins/kkkkkk-10086/config/config.json`, JSON.stringify(change, null, 2), { flag: 'w' })
        } catch (err) {
            logger.error(err)
            return false
        }
        return true
    }
})
