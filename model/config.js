import fs from 'fs'
import lodash from 'lodash'


const configPath = process.cwd() + '/plugins/kkkkkk-10086/config/config.json'

const defaultConfig = {
    "rmmp4": true,
    "voicebox": true,
    "videotool": true,
    "token": "dd10ZSheAwkbML7P4Yv55tFXFVstyULL",
    "options": {
        "followRedirects": true,
        "redirect": "follow",
        "headers": {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.4209.0 Safari/537.36"
        }
      },
    "comments": false,
    "defaulttool": false,
    
}
let config = {}

function getConfig() {
    const content = fs.readFileSync(configPath);
    return JSON.parse(content);
}

config = Object.assign({}, defaultConfig, config)
if (fs.existsSync(configPath)) {
    const fullPath = fs.realpathSync(configPath)
    const data = fs.readFileSync(fullPath)
    if (data) {
        try { config = JSON.parse(data) } catch (e) { logger.error('kkkkkk-10086读取配置文件出错', e) }
    }
}
export const Config = new Proxy(config, {
    get(target, prop) {
        const config = getConfig();
        return config[prop];
    },

    set(target, property, value) {
        target[property] = value
        const merged = Object.assign({}, defaultConfig, target)
        try {
            fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), { flag: 'w' })
        } catch (err) {
            logger.error(err)
            return false
        }
        return true
    }
})