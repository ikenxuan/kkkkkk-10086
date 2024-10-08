import Version from '../../components/Version.js'

/**
 * @type {import('node-karin')['Plugin']}
 */
const plugin = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('node-karin')).Plugin
    case 'yunzai':
      return (await import('yunzai')).Plugin
    default:
      return global.plugin
  }
})()

export default plugin
