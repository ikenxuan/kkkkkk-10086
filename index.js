import fs from 'node:fs'
import chalk from 'chalk'

const files = fs.readdirSync('./plugins/kkkkkk-10086/apps').filter(file => file.endsWith('.js'))

let ret = []

logger.info(chalk.blueBright('------------------------------------'))
logger.info(`~\t${chalk.redBright(`欢迎使用kkkkkk插件`)}\t~`)
logger.info(chalk.blueBright('------------------------------------'))



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
