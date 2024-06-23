import Version from './Version.js'
import Render from './Render.js'
import { Config } from './Config.js'
import GetID from './GetID.js'
import Base from './Base.js'
import UploadRecord from './UploadRecord.js'
import Image from './Image.js'
import Networks from './Networks.js'
import Pushlist from './Pushlist.js'
import DB from '../db/index.js'
import Init from '../init.js'

export { Version, Render, Config, GetID, Base, UploadRecord, Image, Networks, Pushlist, DB, Sleep, Init }

/**
 * 休眠函数
 * @param ms 毫秒
 */
function Sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
