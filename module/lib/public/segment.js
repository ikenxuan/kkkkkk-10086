import { Version } from '#components'

const segment = await (async () => {
  switch (Version.BotName) {
  case 'Karin':
    return (await import('node-karin')).segment
  case 'Miao-Yunzai V4':
    return (await import('yunzai/core')).Segment
  default:
    return global.segment
  }
})()

export default segment
