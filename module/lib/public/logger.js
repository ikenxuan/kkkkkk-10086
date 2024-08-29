import Version from '../../components/Version.js'

/**
 * @type { import('node-karin').logger }
 */
const logger = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('node-karin')).logger
    default:
      return global.logger
  }
})()

export default logger
