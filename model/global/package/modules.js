import { GetID } from '../judgment.js'
import common from '../../../../../lib/common/common.js'
import { Config } from '../../config.js'
import base from '../base.js'
import uploadRecord from '../uploadRecord.js'
import image from '../image.js'
import networks from '../networks.js'
import cfg from '../../../../../lib/config/config.js'
import Version from '../components/Version.js'
import Render from '../components/Render.js'
import { pushlist } from '../pushlist.js'
import DB from '../db/index.js'

export { base, networks, GetID, pushlist, uploadRecord, image, common, Config, Render, Version, Plugin_Name, Plugin_Path, Path as _path, cfg as botCfg, DB }

const Path = process.cwd()
const Plugin_Name = 'kkkkkk-10086'
const Plugin_Path = `${Path}/plugins/${Plugin_Name}`
