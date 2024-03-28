import cfg from '../../../../lib/config/config.js'
import networks from './networks.js'
import { Config } from '../config.js'

export default class base {
  constructor(e = {}) {
    this.e = e
    this.headers = {
      Accept: '*/*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
    this.numcomments = Config.numcomments
    this.comments = Config.comments
    this.URL = ''
    this.botCfg = cfg
    this.Config = Config
    this._path = process.cwd()
    this.ConfigPath = process.cwd() + '/plugins/kkkkkk-10086/config/config.json'
    this.networks = networks
  }
  get allow() {
    return Config.ck !== ''
  }
}
