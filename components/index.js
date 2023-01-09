const Path = process.cwd();
const Plugin_Name = 'kkkkkk-10086'
const Plugin_Path = `${Path}/plugins/${Plugin_Name}`;
import Version from './Version.js'
import Data from './Data.js'
import Common from './Common.js'
import Config from './Config.js'
import render from './common-lib/renderer.js';
export { render, Data, Common, Config, Version, Path, Plugin_Name, Plugin_Path }