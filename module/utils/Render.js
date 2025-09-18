import puppeteer from '../../../../lib/puppeteer/puppeteer.js'
import { Config, Common, logger } from './index.js'
import { execSync } from 'child_process'
import Version from './Version.js'
import simpleGit from 'simple-git'
import path, { join } from 'node:path'
import reactServerRender from 'karin-plugin-kkk/template'

/**
 * 渲染HTML模板为图片
 * @param {string} path html模板路径
 * @param {Object.<string, *>} [params] 模板参数 [可选]
 * @property {number} [params.scale] 模板缩放比例
 * @returns {Promise<Array<ImageData>>} 返回渲染后的图片对象数组或false
 */
export const Render = async (path, params) => {
  return await SSR(path, params)
}

/**
 * SSR渲染
 * @param path 组件路径标识，格式：platform/category/templateName 或 platform/templateName
 * @param params 模板参数
 * @returns 图片元素数组
 */
const SSR = async (path, params) => {
  const pathParts = path.split('/')
  let templateType
  let templateName

  if (pathParts.length === 2) {
    // 二级路径：platform/templateName
    [templateType, templateName] = pathParts
  } else if (pathParts.length === 3) {
    // 三级路径：platform/category/templateName
    templateType = pathParts[0]
    templateName = `${pathParts[1]}/${pathParts[2]}`
  } else {
    throw new Error(`不支持的路径格式: ${path}`)
  }

  const outputDir = join(process.cwd())
  const renderRequest = {
    templateType: templateType,
    templateName,
    data: {
      ...params,
      useDarkTheme: Common.useDarkTheme()
    },
    version: {
      pluginName: 'kkk',
      pluginVersion: Version.version,
      releaseType: /^\d+\.\d+\.\d+$/.test(Version.version) ? 'Stable' : 'Preview',
      poweredBy: 'Yunzai'
    },
    scale: Math.min(2, Math.max(0.5, Number(Config.app.renderScale) / 100))
  }

  // 调用本地SSR渲染函数
  const result = await reactServerRender(renderRequest, outputDir)

  process.env.NODE_ENV
  if (!result.success || !result.htmlPath) {
    throw new Error(result.error || 'SSR渲染失败')
  }

  return await puppeteer.screenshots(join(Version.pluginName, result.htmlPath), {})

}