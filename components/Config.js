import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import lodash from 'lodash'
import YamlReader from '../model/YamlReader.js'

const Path = process.cwd();
const Plugin_Name = 'kkkkkk-10086'
const Plugin_Path = `${Path}/plugins/${Plugin_Name}`;


class Config {
	constructor () {
    this.config = {}
	

    /** 监听文件 */
    this.watcher = {}

    this.initCfg()
  }
initCfg() {
    let path = `${Plugin_Path}/config/`
    let pathDef = `${Plugin_Path}/config/default/`
    const files = fs.readdirSync(pathDef).filter(file => file.endsWith('pz.yaml'))
    for (let file of files) {
      if (!fs.existsSync(`${path}${file}`)) {
        fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
      }
    }
  }
  /**
   * @param app  功能
   * @param name 配置文件名称
   */
 
  
  getdefSet (app, name) {
    return this.getYaml(app, name, 'defSet')
  }
  
  /** 用户配置 */
  getConfig (app, name) {
	return this.getYaml(app, name, 'config')
  }

  saveConfig (app, name, data) {
    return this.save(app, name, 'config',data)
  }

  /**
   * 获取配置yaml
   * @param app 功能
   * @param name 名称
   * @param type 默认跑配置-defSet，用户配置-config
   */
  getYaml (app, name, type) {
    let file = this.getFilePath(app, name, type)
    let key = `${app}.${name}`

    if (this.config[type][key]) return this.config[type][key]

    try {
      this.config[type][key] = YAML.parse(
        fs.readFileSync(file, 'utf8')
      )
    } catch (error) {
      return false
    }

    this.watch(file, app, name, type)

    return this.config[type][key]
  }

  getFilePath (app, name, type) {
	  if(!this.config[type]){
		  this.config[type] = {};
	  }
	  
	  if(!this.watcher[type]){
		  this.watcher[type] = {};
	  }
	  
	  let config_path = `${Plugin_Path}/${type}/`;
	  let file = `${config_path}${app}.${name}.yaml`;
	  try{
		  if(!fs.existsSync(file)){
			  let default_file = `${config_path}default/${app}.${name}.yaml`;
			  fs.copyFileSync(default_file,file);
		  }
	  }catch(err){}
	  return file;
  }

  /** 监听配置文件 */
  watch (file, app, name, type = 'config') {
    let key = `${app}.${name}`

    if (this.watcher[type][key]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', path => {
      delete this.config[type][key]
      logger.mark(`[kkkkk插件][修改配置文件][${type}][${app}][${name}]`)
      this.getYaml(app, name, type)//重新读取文件
      if (this[`change_${app}${name}`]) {
        this[`change_${app}${name}`]()
      }
    })

    this.watcher[type][key] = watcher
  }
  
  save (app, name, type, data) {
	let file = this.getFilePath(app, name, type)
    if (lodash.isEmpty(data)) {
      fs.existsSync(file) && fs.unlinkSync(file)
    } else {
      let yaml = YAML.stringify(data)
      fs.writeFileSync(file, yaml, 'utf8')
    }
  }
  modify(name, key, value) {
    let path = `${Plugin_Path}/config/${name}.yaml`
    new YamlReader(path).set(key, value)
    delete this.config[`${name}`]
  }
}
export default new Config()