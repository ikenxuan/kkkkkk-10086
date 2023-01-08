import { Data, Version, Plugin_Name } from './index.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'
import fs from 'fs'
const _path = process.cwd()
export default async function (path, params, cfg) {
  let [app, tpl] = path.split('/')
  let { e } = cfg
  let layoutPath = process.cwd() + `/plugins/${Plugin_Name}/resources/common/layout/`
  let resPath = `../../../../../plugins/${Plugin_Name}/resources/`
  Data.createDir(`data/html/${Plugin_Name}/${app}/${tpl}`, 'root')
  let data = {
    ...params,
    _plugin: Plugin_Name,
    saveId: params.saveId || params.save_id || tpl,
    tplFile: `./plugins/${Plugin_Name}/resources/${app}/${tpl}.html`,
    pluResPath: resPath,
    _res_path: resPath,
    _layout_path: layoutPath,
    _tpl_path: process.cwd() + `/plugins/${Plugin_Name}/resources/common/tpl/`,
    defaultLayout: layoutPath + 'default.html',
    elemLayout: layoutPath + 'elem.html',
    pageGotoParams: {
      waitUntil: 'networkidle0'
    },
    sys: {
      scale: `style=transform:scale(${cfg.scale || 1})`,
	    copyright: `Yunzai-Bot<span class="version">${Version.yunzai}</span> & kkkkkk-10086<span class="version">${Version.ver}</span>`
    },
    quality: 100
  }
  if (process.argv.includes('web-debug')) {
    let saveDir = _path + '/data/ViewData/'
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir)
    }
    let file = saveDir + tpl + '.json'
    data._app = app
    fs.writeFileSync(file, JSON.stringify(data))
  }
  let base64 = await puppeteer.screenshot(`${Plugin_Name}/${app}/${tpl}`, data)
  let ret = true
  if (base64) {
    ret = await e.reply(base64)
  }
  return cfg.retMsgId ? ret : true
}