import base from '../../base.js'
import { MsToken } from './MsToken.js'
import * as xbogus from './X-Bogus.cjs'

export default class sign extends base {
	async Mstoken(length) {
		return MsToken(length)
	}

	async XB(url) {
		return xbogus.sign(
			new URLSearchParams(new URL(url).search).toString(),
			this.headers['User-Agent']
		)
	}
}

export const Sign = new sign()
