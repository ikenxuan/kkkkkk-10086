import Version from '../../components/Version.js'

/**
 * @type { import('node-karin').segment }
 */
const segment = await (async () => {
  switch (Version.BotName) {
    case 'Karin':
      return (await import('node-karin')).segment
    case 'yunzai':
      return (await import('yunzai')).Segment
    default:
      return global.segment
  }
})()

export default segment
