import { Config, Version } from '#modules'
import lodash from 'lodash'
import fs from 'fs'
import puppeteer from '../../../../../lib/puppeteer/puppeteer.js'

function scale(pct = 1) {
  let scale = Config.renderScale
  scale = Math.min(2, Math.max(0.5, scale / 100))
  pct = pct * scale
  return `style=transform:scale(${pct})`
}

const Render = {
  /**
   *
   * @param {*} path 渲染模板路径，相对于插件目录resources/
   * @param {*} params 渲染变量
   * @param {*} cfg 渲染配置
   * @returns
   */
  async render(path, params, cfg = { retType: 'default', saveId: '' }) {
    let { e } = cfg
    if (!e.runtime) {
      return render('kkkkkk-10086', path, params, {
        retType: cfg.retType,
        beforeRender({ data }) {
          let pluginName = ''
          if (data.pluginName !== false) {
            pluginName = ` & ${data.pluginName || 'kkkkkk-10086'}`
            if (data.pluginVersion !== false) {
              pluginName += `<span class="version">${data.pluginVersion || Version.version}`
            }
          }
          let resPath = data.pluResPath
          const layoutPath = process.cwd() + '/plugins/kkkkkk-10086/resources/html/COMMON/layout/'
          const saveId = data.saveId
          return {
            ...data,
            saveId,
            _res_path: resPath,
            _kkk_path: resPath,
            _layout_path: layoutPath,
            defaultLayout: layoutPath + 'default.html',
            elemLayout: layoutPath + 'elem.html',
            sys: {
              scale: scale(cfg.scale || 1),
            },
            copyright: `${Version.yunzaiName}<span class="version">${Version.yunzai}</span>${pluginName}</span>`,
            pageGotoParams: {
              waitUntil: 'networkidle2',
            },
          }
        },
      })
    }

    return e.runtime.render('kkkkkk-10086', path, params, {
      retType: cfg.retType,
      beforeRender({ data }) {
        let pluginName = ''
        if (data.pluginName !== false) {
          pluginName = ` & ${data.pluginName || 'kkkkkk-10086'}`
          if (data.pluginVersion !== false) {
            pluginName += `<span class="version">${data.pluginVersion || Version.version}`
          }
        }
        let resPath = data.pluResPath
        const layoutPath = process.cwd() + '/plugins/kkkkkk-10086/resources/html/COMMON/layout/'
        const saveId = data.saveId
        return {
          ...data,
          saveId,
          _res_path: resPath,
          _kkk_path: resPath,
          _layout_path: layoutPath,
          defaultLayout: layoutPath + 'default.html',
          elemLayout: layoutPath + 'elem.html',
          sys: {
            scale: scale(cfg.scale || 1),
          },
          copyright: `${Version.yunzaiName}<span class="version">${Version.yunzai}</span>${pluginName}</span>`,
          pageGotoParams: {
            waitUntil: 'networkidle2',
          },
        }
      },
    })
  },
}

/**
 *
 * @param plugin plugin key
 * @param path html文件路径，相对于plugin resources目录
 * @param data 渲染数据
 * @param cfg 渲染配置
 * @param cfg.retType 返回值类型
 * * default/空：自动发送图片，返回true
 * * msgId：自动发送图片，返回msg id
 * * base64: 不自动发送图像，返回图像base64数据
 * @param cfg.beforeRender({data}) 可改写渲染的data数据
 * @returns {Promise<boolean>}
 */
async function render(plugin, path, data = {}, cfg = {}) {
  // 处理传入的path
  path = path.replace(/.html$/, '')
  let paths = lodash.filter(path.split('/'), (p) => !!p)
  path = paths.join('/')
  // 创建目录
  mkdir(`temp/html/${plugin}/${path}`)
  // 自动计算pluResPath
  let pluResPath = `../../../${lodash.repeat('../', paths.length)}plugins/${plugin}/resources/`
  let miaoResPath = `../../../${lodash.repeat('../', paths.length)}plugins/miao-plugin/resources/`
  const layoutPath = process.cwd() + '/plugins/miao-plugin/resources/common/layout/'
  // 渲染data
  data = {
    sys: {
      scale: 1,
    },
    /** miao 相关参数 **/
    copyright: `Created By TRSS-Yunzai<span class="version">${Version.yunzai}</span> `,
    _res_path: pluResPath,
    _miao_path: miaoResPath,
    _tpl_path: process.cwd() + '/plugins/miao-plugin/resources/common/tpl/',
    defaultLayout: layoutPath + 'default.html',
    elemLayout: layoutPath + 'elem.html',
    dynamicLayout: process.cwd() + '/plugins/kkkkkk-10086/resources/html/COMMON/layout/dynamic.html',
    ...data,

    /** 默认参数 **/
    _plugin: plugin,
    _htmlPath: path,
    pluResPath,
    tplFile: `./plugins/${plugin}/resources/${path}.html`,
    saveId: data.saveId || data.save_id || paths[paths.length - 1],
  }
  // 处理beforeRender
  if (cfg.beforeRender) {
    data = cfg.beforeRender({ data }) || data
  }
  // 保存模板数据
  if (process.argv.includes('dev')) {
    // debug下保存当前页面的渲染数据，方便模板编写与调试
    // 由于只用于调试，开发者只关注自己当时开发的文件即可，暂不考虑app及plugin的命名冲突
    let saveDir = mkdir(`temp/ViewData/${plugin}`)
    let file = `${saveDir}/${data._htmlPath.split('/').join('_')}.json`
    fs.writeFileSync(file, JSON.stringify(data))
  }
  // 截图
  let base64 = await puppeteer.screenshot(`${plugin}/${path}`, data)
  if (cfg.retType === 'base64') {
    return base64
  }
  let ret = true
  if (base64) {
    if (cfg.recallMsg) {
      ret = await this.e.reply(base64, false, {})
    } else {
      ret = await this.e.reply(base64)
    }
  }
  return cfg.retType === 'msgId' ? ret : true
}

const mkdir = (check) => {
  let currDir = `${process.cwd()}/temp`
  for (let p of check.split('/')) {
    currDir = `${currDir}/${p}`
    if (!fs.existsSync(currDir)) {
      fs.mkdirSync(currDir)
    }
  }
  return currDir
}
export default Render
