import puppeteer from '../../../../lib/puppeteer/puppeteer.js'
import { botCfg } from '#modules'
/**
 * 浏览器截图
 * @param {*} file html模板名称，传html文件夹下的相对路径
 * @param {*} name 缓存，渲染完成保存在temp/html/插件名/
 * @param {object} obj 渲染变量，类型为对象
 * @returns
 */
async function image(file, name, obj) {
  let botname = botCfg.package.name
  if (botCfg.package.name == `yunzai`) {
    botname = `Yunzai-Bot`
  } else if (botCfg.package.name == `miao-yunzai`) {
    botname = `Miao-Yunzai`
  } else if (botCfg.package.name == `trss-yunzai`) {
    botname = `TRSS-Yunzai`
  } else if (botCfg.package.name == `a-yunzai`) {
    botname = `A-Yunzai`
  } else if (botCfg.package.name == `biscuit-yunzai`) {
    botname = `Biscuit-Yunzai`
  }
  let data = {
    quality: 100,
    tplFile: `./plugins/kkkkkk-10086/resources/html/${file}.html`,
    ...obj,
  }
  let img = await puppeteer.screenshot(name, {
    botname,
    MiaoV: botCfg.package.version,
    ...data,
  })

  return img
}

export default image
