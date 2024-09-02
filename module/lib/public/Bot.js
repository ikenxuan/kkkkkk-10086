import { Version } from '../../components/index.js'

/**
 * @type { import('node-karin').Karin }
 */
const Bot = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('node-karin')).karin
    case 'yunzai':
      return (await import('yunzai')).Bot
    default:
      return global.Bot
  }
})()

export default Bot
