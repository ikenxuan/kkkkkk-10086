import fs from 'fs'
import path from 'path'

const _path = process.cwd()
const files = fs.readdirSync('./plugins/kkkkkk-10086/apps').filter((file) => file.endsWith('.js'))

async function configfile() {
  const configPath = process.cwd() + '/plugins/kkkkkk-10086/config/config.json'
  const configExampleFile = process.cwd() + '/plugins/kkkkkk-10086/config/config.example.json'
  fs.access(configPath, fs.constants.F_OK, (err) => {
    if (err) {
      fs.copyFile(configExampleFile, configPath, (err) => {
        if (err) throw err
        logger.info(logger.green('检测到kkkkkk-10086配置文件不存在，已自动创建 config.json created success'))
      })
    }
  })
}
await configfile()

const videodir = `${_path}/resources/kkkdownload/video`
const imgdir = `${_path}/resources/kkkdownload/images`
const dirs = [videodir, imgdir]
for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    mkdirs(dir)
  }
}

const readmePath = `${_path}/resources/kkkdownload/README.md`
if (!fs.existsSync(readmePath)) {
  fs.writeFileSync(readmePath, '# 这是一个缓存文件夹\n\n## 开源项目[kkkkkk-10086](https://github.com/ikenxuan/kkkkkk-10086)', { flag: 'w' })
}
function mkdirs(dirname) {
  if (fs.existsSync(dirname)) {
    return true
  } else {
    if (mkdirs(path.dirname(dirname))) {
      fs.mkdirSync(dirname)
      return true
    }
  }
}

let ret = []

logger.info('kkkkkk-10086初始化\n交流群：795874649')

files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
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
export { apps }
