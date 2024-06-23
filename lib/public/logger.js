import { Version } from '#components'

const logger = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('#Karin')).logger
    case 'Miao-Yunzai V4':
      return global.logger
    default:
      return global.logger
  }
})()

export default logger
