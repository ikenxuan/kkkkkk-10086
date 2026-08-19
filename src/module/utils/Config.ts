import fs from 'node:fs'
import { join } from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import _ from 'lodash'
import YAML from 'yaml'
import type {
  AmagiConfig,
  AppConfig,
  BilibiliConfig,
  ConfigName,
  ConfigSource,
  CookiesConfig,
  DouyinConfig,
  KuaishouConfig,
  PluginConfigMap,
  PushlistConfig,
  RequestConfig,
  UploadConfig,
  XiaohongshuConfig
} from '@/types/config'
import YamlReader from './YamlReader.js'
import Version from './Version.js'

export type {
  BilibiliPushItem,
  PushlistConfig,
  DouyinPushItem
} from '@/types/config'
export type {
  DouyinPushItem as douyinPushItem,
  BilibiliPushItem as bilibiliPushItem
} from '@/types/config'

const APP_UPLOAD_KEYS = new Set([
  'videoSendMode',
  'sendbase64',
  'usefilelimit',
  'filelimit',
  'compress',
  'compresstrigger',
  'compressvalue',
  'usegroupfile',
  'groupfilevalue',
  'imageSendMode',
  'downloadMultiThread',
  'downloadConcurrency',
  'downloadThrottle',
  'downloadMaxSpeed',
  'downloadAutoReduce',
  'downloadMinSpeed'
])

const CONFIG_NAMES: ConfigName[] = [
  'app',
  'bilibili',
  'cookies',
  'douyin',
  'kuaishou',
  'pushlist',
  'request',
  'upload',
  'xiaohongshu'
]

interface FilterItem {
  switch?: boolean
  filterMode?: 'blacklist' | 'whitelist'
  Keywords?: string[]
  Tags?: string[]
}

interface FilterDatabase<TId extends string | number> {
  updateFilterMode?: (id: TId, mode: 'blacklist' | 'whitelist') => Promise<unknown>
  getFilterWords?: (id: TId) => Promise<string[] | undefined>
  removeFilterWord?: (id: TId, word: string) => Promise<unknown>
  addFilterWord?: (id: TId, word: string) => Promise<unknown>
  getFilterTags?: (id: TId) => Promise<string[] | undefined>
  removeFilterTag?: (id: TId, tag: string) => Promise<unknown>
  addFilterTag?: (id: TId, tag: string) => Promise<unknown>
}

type CompleteConfig = Partial<PluginConfigMap> & {
  app?: AppConfig & UploadConfig
  amagi: AmagiConfig
}

type ConfigService = PluginConfigMap & {
  amagi: AmagiConfig
  All: Cfg['All']
  modify: Cfg['modify']
  ModifyPro: Cfg['ModifyPro']
  /** 运行时的 Proxy 会转发这个方法，业务代码里以 `Config.getConfig?.(name)` 的形式调用 */
  getConfig: Cfg['getConfig']
  syncConfigToDatabase: Cfg['syncConfigToDatabase']
  initCfg: Cfg['initCfg']
}

export class Cfg {
  readonly pluginRoot: string
  config: Record<string, unknown> = {}
  watcher: Record<string, FSWatcher> = {}

  constructor (pluginRoot = Version.pluginPath) {
    this.pluginRoot = pluginRoot
  }

  initCfg (): this {
    const userPath = this.configDirectory('config')
    const defaultPath = this.configDirectory('default_config')
    if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true })
    const files = fs.readdirSync(defaultPath).filter(file => file.endsWith('.yaml'))

    for (const file of files) {
      const userFile = join(userPath, file)
      const defaultFile = join(defaultPath, file)
      const name = file.slice(0, -'.yaml'.length)
      if (!isConfigName(name)) continue

      if (!fs.existsSync(userFile)) {
        fs.copyFileSync(defaultFile, userFile)
      } else {
        const configResult = this.parseYamlRecordResult(userFile)
        if (!configResult.valid) {
          this.watch(userFile, name, 'config')
          continue
        }
        const defConfigResult = this.parseYamlRecordResult(defaultFile)
        if (!defConfigResult.valid) {
          this.watch(userFile, name, 'config')
          continue
        }
        const { differences, result } = this.mergeObjectsWithPriority(configResult.value, defConfigResult.value)
        if (differences) {
          fs.copyFileSync(defaultFile, userFile)
          for (const [key, value] of Object.entries(result)) this.modify(name, key, value)
        }
      }
      this.watch(userFile, name, 'config')
    }
    return this
  }

  get app (): AppConfig {
    return this.getDefOrConfig('app')
  }

  get cookies (): CookiesConfig {
    return this.getDefOrConfig('cookies')
  }

  get douyin (): DouyinConfig {
    return this.getDefOrConfig('douyin')
  }

  get bilibili (): BilibiliConfig {
    return this.getDefOrConfig('bilibili')
  }

  get pushlist (): PushlistConfig {
    return this.getDefOrConfig('pushlist')
  }

  get kuaishou (): KuaishouConfig {
    return this.getDefOrConfig('kuaishou')
  }

  get xiaohongshu (): XiaohongshuConfig {
    return this.getDefOrConfig('xiaohongshu')
  }

  get request (): RequestConfig {
    return this.getDefOrConfig('request')
  }

  get upload (): UploadConfig {
    return this.getDefOrConfig('upload')
  }

  get amagi (): AmagiConfig {
    const request = this.request
    const app = this.app
    return {
      timeout: request.timeout,
      'User-Agent': request['User-Agent'],
      proxy: request.proxy,
      cookies: this.cookies,
      APIServer: app.APIServer,
      APIServerMount: app.APIServerMount,
      APIServerPort: app.APIServerPort
    }
  }

  async All (): Promise<CompleteConfig> {
    const rawConfig: Record<string, unknown> = {}
    const files = fs.readdirSync(this.configDirectory('default_config')).filter(file => file.endsWith('.yaml'))

    for (const file of files) {
      const name = file.slice(0, -'.yaml'.length)
      if (isConfigName(name)) rawConfig[name] = this.getDefOrConfig(name)
    }

    const config = rawConfig as Partial<PluginConfigMap>
    if (config.pushlist) {
      const { getDouyinDB, getBilibiliDB } = await import('@/module/db/index')
      const douyinDB = await getDouyinDB()
      const bilibiliDB = await getBilibiliDB()
      try {
        if (config.pushlist.douyin) {
          for (const item of config.pushlist.douyin) {
            const filterWords = await callLegacyLookup<string[]>(douyinDB, douyinDB?.getFilterWords, item.sec_uid)
            const filterTags = await callLegacyLookup<string[]>(douyinDB, douyinDB?.getFilterTags, item.sec_uid)
            const userInfo = await callLegacyLookup<{ filterMode?: 'blacklist' | 'whitelist' }>(
              douyinDB,
              douyinDB?.getDouyinUser,
              item.sec_uid
            )
            if (userInfo) item.filterMode = userInfo.filterMode || 'blacklist'
            item.Keywords = filterWords
            item.Tags = filterTags
          }
        }
        if (config.pushlist.bilibili) {
          for (const item of config.pushlist.bilibili) {
            const filterWords = await bilibiliDB?.getFilterWords(item.host_mid)
            const filterTags = await bilibiliDB?.getFilterTags(item.host_mid)
            const userInfo = await bilibiliDB?.getOrCreateBilibiliUser(item.host_mid)
            if (userInfo) item.filterMode = userInfo.filterMode || 'blacklist'
            item.Keywords = filterWords
            item.Tags = filterTags
          }
        }
      } catch (error: unknown) {
        logger.error(`从数据库获取过滤配置时出错: ${String(error)}`)
      }
    }

    const result: CompleteConfig = { ...config, amagi: this.amagi }
    if (config.app && config.upload) {
      result.app = {
        ...config.app,
        ...config.upload,
        videoSendMode: config.upload.videoSendMode || (config.upload.sendbase64 ? 'base64' : 'file')
      }
    }
    return result
  }

  getDefOrConfig<K extends ConfigName> (name: K): PluginConfigMap[K] {
    return { ...this.getdefSet(name), ...this.getConfig(name) }
  }

  getdefSet<K extends ConfigName> (name: K): PluginConfigMap[K] {
    return this.getYaml('default_config', name) as unknown as PluginConfigMap[K]
  }

  getConfig<K extends ConfigName> (name: K): Partial<PluginConfigMap[K]> {
    return this.getYaml('config', name) as Partial<PluginConfigMap[K]>
  }

  getYaml (type: ConfigSource, name: ConfigName): Record<string, unknown> {
    const file = this.configFile(type, name)
    const key = `${type}.${name}`
    const cached = this.config[key]
    if (isRecord(cached)) return cached

    let value: Record<string, unknown> = {}
    if (fs.existsSync(file)) value = this.parseYamlRecord(file)
    this.config[key] = value
    this.watch(file, name, type)
    return value
  }

  watch (file: string, name: ConfigName, type: ConfigSource = 'default_config'): void {
    const key = `${type}.${name}`
    if (this.watcher[key]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', async () => {
      delete this.config[key]
      logger.mark(`[${Version.pluginName}][修改配置文件][${type}][${name}]`)
      if (name === 'pushlist' && type === 'config') {
        try {
          await this.syncPushlistToDatabase()
        } catch (error: unknown) {
          logger.error('[Config] 文件监听同步数据库失败:', error)
        } finally {
          await this.syncConfigToDatabase()
        }
      }
    })
    this.watcher[key] = watcher
  }

  modify<K extends ConfigName> (name: K, key: string, value: unknown, type: ConfigSource = 'config'): void {
    new YamlReader(this.configFile(type, name)).set(key, value)
    delete this.config[`${type}.${name}`]
  }

  ModifyPro (name: ConfigName | 'amagi', value: Record<string, unknown>, type: ConfigSource = 'config'): boolean {
    if (!isRecord(value)) return false
    if (name === 'amagi') {
      if ('timeout' in value) this.modify('request', 'timeout', value.timeout, type)
      if ('User-Agent' in value) this.modify('request', 'User-Agent', value['User-Agent'], type)
      if ('proxy' in value) this.modify('request', 'proxy', value.proxy, type)
      if (isRecord(value.cookies)) this.ModifyPro('cookies', value.cookies, type)
      if ('APIServer' in value) this.modify('app', 'APIServer', value.APIServer, type)
      if ('APIServerMount' in value) this.modify('app', 'APIServerMount', value.APIServerMount, type)
      if ('APIServerPort' in value) this.modify('app', 'APIServerPort', value.APIServerPort, type)
      return true
    }

    if (name === 'app') {
      const appValue: Record<string, unknown> = {}
      const uploadValue: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value)) {
        if (APP_UPLOAD_KEYS.has(key)) uploadValue[key] = item
        else appValue[key] = item
      }
      if ('videoSendMode' in uploadValue) uploadValue.sendbase64 = uploadValue.videoSendMode === 'base64'
      const appSuccess = Object.keys(appValue).length ? this.writeModuleConfig('app', appValue, type) : true
      const uploadSuccess = Object.keys(uploadValue).length ? this.writeModuleConfig('upload', uploadValue, type) : true
      return appSuccess && uploadSuccess
    }

    return this.writeModuleConfig(name, value, type)
  }

  async syncPushlistToDatabase (): Promise<void> {
    const { getDouyinDB, getBilibiliDB } = await import('@/module/db/index')
    try {
      const pushlistConfig = this.getDefOrConfig('pushlist')
      if (pushlistConfig.douyin) {
        await this.syncFilterConfigToDb(pushlistConfig.douyin, await getDouyinDB(), 'sec_uid')
      }
      if (pushlistConfig.bilibili) {
        await this.syncFilterConfigToDb(pushlistConfig.bilibili, await getBilibiliDB(), 'host_mid')
      }
      logger.info('[Config] pushlist的过滤配置已同步到数据库')
    } catch (error: unknown) {
      logger.error('[Config] 同步pushlist配置到数据库失败:', error)
      throw error
    }
  }

  async syncFilterConfigToDb<
    TItem extends FilterItem,
    TId extends string | number
  > (
    items: TItem[],
    db: FilterDatabase<TId> | null | undefined,
    idField: keyof TItem
  ): Promise<void> {
    for (const item of items) {
      if (!item.switch) continue
      const rawId = item[idField]
      if (!rawId || (typeof rawId !== 'string' && typeof rawId !== 'number')) continue
      const id = rawId as TId

      if (item.filterMode !== undefined) await db?.updateFilterMode?.(id, item.filterMode)
      const configWords = item.Keywords || []
      const existingWords = await db?.getFilterWords?.(id)
      for (const word of existingWords || []) {
        if (!configWords.includes(word)) await db?.removeFilterWord?.(id, word)
      }
      for (const word of configWords) {
        if (!existingWords?.includes(word)) await db?.addFilterWord?.(id, word)
      }

      const configTags = item.Tags || []
      const existingTags = await db?.getFilterTags?.(id)
      for (const tag of existingTags || []) {
        if (!configTags.includes(tag)) await db?.removeFilterTag?.(id, tag)
      }
      for (const tag of configTags) {
        if (!existingTags?.includes(tag)) await db?.addFilterTag?.(id, tag)
      }
    }
  }

  mergeObjectsWithPriority (objA: Record<string, unknown>, objB: Record<string, unknown>): {
    differences: boolean
    result: Record<string, unknown>
  } {
    let differences = false
    const customizer = (objValue: unknown, srcValue: unknown): unknown => {
      if (_.isArray(objValue) && _.isArray(srcValue)) return objValue
      if (_.isPlainObject(objValue) && _.isPlainObject(srcValue)) {
        if (!_.isEqual(objValue, srcValue)) {
          return _.mergeWith(_.cloneDeep(objValue), srcValue, customizer) as unknown
        }
      } else if (!_.isEqual(objValue, srcValue)) {
        differences = true
        return objValue !== undefined ? objValue : srcValue
      }
      return objValue !== undefined ? objValue : srcValue
    }
    const result = _.mergeWith(_.cloneDeep(objA), objB, customizer) as Record<string, unknown>
    return { differences, result }
  }

  async syncConfigToDatabase (): Promise<void> {
    try {
      const pushCfg = this.getDefOrConfig('pushlist')
      const { getDouyinDB, getBilibiliDB } = await import('@/module/db/index')
      const douyinDB = await getDouyinDB()
      const bilibiliDB = await getBilibiliDB()
      if (pushCfg.bilibili) await bilibiliDB?.syncConfigSubscriptions(pushCfg.bilibili)
      if (pushCfg.douyin) await douyinDB?.syncConfigSubscriptions(pushCfg.douyin)
      logger.debug('[BilibiliDB] + [DouyinDB] 配置已同步到数据库')
    } catch (error: unknown) {
      logger.error('同步配置到数据库失败:', error)
    }
  }

  private configDirectory (type: ConfigSource): string {
    return join(this.pluginRoot, 'config', type)
  }

  private configFile (type: ConfigSource, name: ConfigName): string {
    return join(this.configDirectory(type), `${name}.yaml`)
  }

  private parseYamlRecord (file: string): Record<string, unknown> {
    return this.parseYamlRecordResult(file).value
  }

  private parseYamlRecordResult (file: string): {
    valid: boolean
    value: Record<string, unknown>
  } {
    try {
      const value: unknown = YAML.parse(fs.readFileSync(file, 'utf8'))
      if (!isRecord(value)) throw new TypeError('YAML root must be a non-array record')
      return { valid: true, value }
    } catch {
      logger.warn(`[Config] 解析配置文件失败: ${file}`)
      return { valid: false, value: {} }
    }
  }

  private writeModuleConfig (name: ConfigName, value: Record<string, unknown>, type: ConfigSource): boolean {
    const path = this.configFile(type, name)
    if (!fs.existsSync(path)) return false
    const reader = new YamlReader(path)
    for (const [key, item] of Object.entries(value)) reader.document.set(key, item)
    const success = reader.write()
    if (success) delete this.config[`${type}.${name}`]
    return success
  }
}

let configInstance: ConfigService | undefined

const getConfigInstance = (): ConfigService => {
  if (!configInstance) {
    const cfg = new Cfg().initCfg()
    configInstance = new Proxy(cfg, {
      get (target, prop, receiver): unknown {
        if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver)
        if (typeof prop === 'string' && isConfigName(prop)) return target.getDefOrConfig(prop)
        return undefined
      }
    }) as ConfigService
  }
  return configInstance
}

export default new Proxy({} as ConfigService, {
  get (_target, prop): unknown {
    return Reflect.get(getConfigInstance(), prop)
  }
})

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function callLegacyLookup<TResult> (
  receiver: unknown,
  method: unknown,
  id: string | undefined
): Promise<TResult | undefined> {
  if (typeof method !== 'function') return undefined
  return await Reflect.apply(method, receiver, [id]) as TResult
}

function isConfigName (value: string): value is ConfigName {
  return CONFIG_NAMES.includes(value as ConfigName)
}
