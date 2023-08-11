import fs from 'fs'
const _path = process.cwd()
const defaultConfig = {
    "address": "",
    "rmmp4": true,
    "voicebox": true,
    "videotool": true,
}
let config = {}
config = Object.assign({}, defaultConfig, config)
if (fs.existsSync(`${_path}/plugins/kkkkkk-10086/config/config.json`)) {
    const fullPath = fs.realpathSync(`${_path}/plugins/kkkkkk-10086/config/config.json`)
    const data = fs.readFileSync(fullPath)
    if (data) {
        try { config = JSON.parse(data) } catch (e) { logger.error('kkkkkk-10086读取配置文件出错', e) }
    }
}
export const Config = new Proxy(config, {
    set(target, property, value) {
        target[property] = value
        const change = lodash.transform(config, function (result, value, key) {
            if (!lodash.isEqual(value, defaultConfig[key])) {
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