import Version from '../../components/Version.js'
import segment from './segment.js'

const puppeteer = await (async () => {
  switch (Version.BotName) {
    case 'Karin': {
      const Renderer = (await import('node-karin')).render
      const renderImage = async (path, options, multiPage = false) => {
        const mergedOptions = {
          ...options,
          data: { ...options },
          name: Version.pluginName + path,
          file: options.tplFile,
          type: options.imgType || 'jpeg',
          fileID: options.saveId,
          screensEval: '#container',
          multiPage
        }
        const img = await Renderer.render(mergedOptions)
        return segment.image(img)
      }
      return {
        screenshot: (path, options) => renderImage(path, options),
        screenshots: (path, options) => renderImage(path, options, true)
      }
    }
    case 'yunzai':
      return (await import('yunzai')).puppeteer
    default:
      return (await import('../../../../../lib/puppeteer/puppeteer.js')).default
  }
})()

export default puppeteer
