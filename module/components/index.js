import Base from './Base.js'
import Version from './Version.js'
import Render from './Render.js'
import Config from './Config.js'
import UploadRecord from './UploadRecord.js'
import Networks from './Networks.js'
import Pushlist from './Pushlist.js'
import DB from '../db/index.js'
import FFmpeg from './FFmpeg.js'
import Init from '../init.js'
import getMessage from './getMessage.js'

export { Version, Render, Config, Base, UploadRecord, Networks, Pushlist, DB, Sleep, FFmpeg, Init, getMessage }

/**
 * 休眠函数
 * @param ms 毫秒
 */
function Sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
