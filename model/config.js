import fs from 'fs'

const configPath = process.cwd() + '/plugins/kkkkkk-10086/config/config.json'

const defaultConfig = {
	rmmp4: true,
	videotool: true,
	comments: true,
	defaulttool: true,
	numcomments: 20,
	ck: '',
	commentsimg: true,
	newui: true,
}
let config = {}

function getConfig() {
	const content = fs.readFileSync(configPath)
	return JSON.parse(content)
}

config = Object.assign({}, defaultConfig, config)
if (fs.existsSync(configPath)) {
	const fullPath = fs.realpathSync(configPath)
	const data = fs.readFileSync(fullPath)
	if (data) {
		try {
			config = JSON.parse(data)
		} catch (e) {
			logger.error('kkkkkk-10086读取配置文件出错', e)
		}
	}
}
export const Config = new Proxy(config, {
	get(target, prop) {
		const config = getConfig()
		return config[prop]
	},

	set(target, property, value) {
		if (typeof value === 'number') {
			value = Number(value)
		}
		target[property] = value
		const merged = Object.assign({}, defaultConfig, target)
		try {
			fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), {
				flag: 'w',
			})
			console.log('[修改配置文件][kkkkkk-10086][config]')
		} catch (err) {
			logger.error(err)
			return false
		}
		return true
	},
})
