
export default class base {
  constructor (e = {}) {
    this.e = e
    this.userId = e?.user_id
    this.model = 'kkkkkk-10086'
    this._path = process.cwd().replace(/\\/g, '/')
  }

  get prefix () {
    return `Yz:kkkkkk-10086:${this.model}:`
  }

  /**
   * 截图默认数据
   * @param saveId html保存id
   * @param tplFile 模板html路径
   * @param pluResPath 插件资源路径
   */
  get screenData () {
    let headImg = '可莉'

    return {
      saveId: this.userId,
      cwd: this._path,
      tplFile: `./plugins/kkkkkk-10086/resources/html/${this.model}.html`,
      /** 绝对路径 */
      pluResPath: `${this._path}/plugins/kkkkkk-10086/resources/`,
      headStyle: `<style> .head_box { background: url(${this._path}/plugins/kkkkkk-10086/resources/img/namecard/${headImg}.png) #fff; background-position-x: 42px; background-repeat: no-repeat; background-size: auto 101%; }</style>`
    }
  }
}
