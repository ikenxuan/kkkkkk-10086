import Version from '../../components/Version.js'

/**
 * @type { import('node-karin').common }
 */
const common = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('node-karin')).common
    case 'yunzai':
      return await import('yunzai')
    default:
      return (await import('../../../../../lib/common/common.js')).default
  }
})()

export default common
