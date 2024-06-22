import puppeteer from '../../../../lib/puppeteer/puppeteer.js'
import { Version } from '#components'
/**
 * 浏览器截图
 * @param {*} file html模板名称，传html文件夹下的相对路径
 * @param {*} name 缓存，渲染完成保存在temp/html/插件名/
 * @param {object} obj 渲染变量，类型为对象
 * @returns
 */
export default async function Image(file, name, obj) {
  let data = {
    quality: 100,
    tplFile: `./plugins/kkkkkk-10086/resources/html/${file}.html`,
    ...obj,
  }
  let img = await puppeteer.screenshot(name, {
    botname: Version.BotName,
    MiaoV: botCfg.package.version,
    ...data,
  })

  return img
}
