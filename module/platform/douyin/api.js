import { DouyinMethodToFetcher, douyinFetcher } from '@ikenxuan/amagi'
import Config from '../../utils/Config.js'

const buildRequestConfig = () => ({
  timeout: Config.request?.timeout || 15000,
  headers: {
    'User-Agent': Config.request?.['User-Agent']
  },
  proxy: Config.request?.proxy?.switch
    ? {
      host: Config.request.proxy.host,
      port: Number(Config.request.proxy.port),
      protocol: Config.request.proxy.protocol,
      auth: Config.request.proxy.auth
    }
    : false
})

const normalizeArgs = (arg1, arg2) => {
  if (typeof arg1 === 'string') {
    return {
      cookie: arg1,
      options: arg2 || {}
    }
  }

  return {
    cookie: Config.cookies.douyin || '',
    options: arg1 || {}
  }
}

/**
 * Compatibility wrapper for the removed amagi v5 `getDouyinData` API.
 * Keep the old call shape inside this plugin, but dispatch to v6 fetcher methods.
 *
 * @param {string} method Chinese Douyin method name used by older amagi APIs.
 * @param {string | Record<string, any>} [arg1] Cookie or request options.
 * @param {Record<string, any>} [arg2] Request options when arg1 is cookie.
 * @returns {Promise<any>}
 */
export const getDouyinData = async (method, arg1, arg2) => {
  const fetcherMethod = DouyinMethodToFetcher[method]
  if (!fetcherMethod || typeof douyinFetcher[fetcherMethod] !== 'function') {
    throw new Error(`Unsupported Douyin API method: ${method}`)
  }

  const { cookie, options } = normalizeArgs(arg1, arg2)
  return await douyinFetcher[fetcherMethod](options, cookie, buildRequestConfig())
}
