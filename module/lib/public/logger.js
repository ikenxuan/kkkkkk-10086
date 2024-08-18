import Version from '../../components/Version.js'

const logger = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('node-karin')).logger
    default:
      return global.logger
  }
})()

export default logger
