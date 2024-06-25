import { Version } from '#components'

const Bot = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('#Karin')).Bot
    case 'Miao-Yunzai V4':
      return (await import('yunzai/core')).Bot
    default:
      return global.Bot
  }
})()

export default Bot
