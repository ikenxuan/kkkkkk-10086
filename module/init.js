import fs from 'fs'
import path from 'path'
import { Version } from '#components'
import { logger } from '#lib'

class Init {
  async checkCfg () {
    const configPath = process.cwd() + `/plugins/${Version.pluginName}/config/config.json`
    const configExampleFile = process.cwd() + `/plugins/${Version.pluginName}/config/config.example.json`
    fs.access(configPath, fs.constants.F_OK, (err) => {
      if (err) {
        fs.copyFile(configExampleFile, configPath, (err) => {
          if (err) throw err
          logger.info(logger.green('检测到kkkkkk-10086配置文件不存在，已自动创建 config.json created success'))
        })
      }
    })

    async function updateConfig () {
      try {
        const configExample = JSON.parse(fs.readFileSync(process.cwd() + `/plugins/${Version.pluginName}/config/config.example.json`, 'utf8'))
        const config = JSON.parse(fs.readFileSync(process.cwd() + `/plugins/${Version.pluginName}/config/config.json`, 'utf8'))

        // 找出config_example中config没有的键
        const newKeys = Object.keys(configExample).filter((key) => !(key in config))

        // 将新的键添加到config中
        newKeys.forEach((key) => {
          config[key] = configExample[key]
        })

        fs.writeFileSync(process.cwd() + `/plugins/${Version.pluginName}/config/config.json`, JSON.stringify(config, null, 2))
      } catch (error) {
        console.error('Error updating config:', error)
      }
    }

    await updateConfig()

    const videodir = `${Version.pluginPath}/resources/kkkdownload/video`
    const imgdir = `${Version.pluginPath}/resources/kkkdownload/images`
    const dirs = [videodir, imgdir]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        mkdirs(dir)
      }
    }

    const readmePath = `${Version.clientPath}/resources/kkkdownload/README.md`
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, '# 这是一个缓存文件夹\n\n## 开源项目[kkkkkk-10086](https://github.com/ikenxuan/kkkkkk-10086)', { flag: 'w' })
    }
    function mkdirs (dirname) {
      if (fs.existsSync(dirname)) {
        return true
      } else {
        if (mkdirs(path.dirname(dirname))) {
          fs.mkdirSync(dirname)
          return true
        }
      }
    }
  }
  async load () {
    await this.checkCfg()

    const files = fs.readdirSync(`${Version.pluginPath}/apps`).filter((file) => file.endsWith('.js'))
    let ret = []
    files.forEach((file) => {
      ret.push(import(`../apps/${file}`))
    })

    ret = await Promise.allSettled(ret)

    let apps = {}
    for (let i in files) {
      let name = files[i].replace('.js', '')

      if (ret[i].status != 'fulfilled') {
        logger.error(`载入插件错误：${logger.red(name)}`)
        logger.error(ret[i].reason)
        continue
      }
      apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
    }
    return apps
  }
}

export default Init
