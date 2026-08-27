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
import { isRecord } from './record.js'

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

/**
 * Cookie 一律收敛成字符串，「没配置」在插件内部只有空串这一种表示。
 *
 * 为什么必须在这里做：yaml 留空解析出 null，锅巴和手改 yaml 还能塞进数字
 * （`xiaohongshu: 114514` 就是 number），而下游 amagi 对 cookie 只有两种处理，
 * 两者都只认字符串：
 * - `cookie?.trim()` 拼请求头 —— 传 number 直接 `cookie?.trim is not a function`
 *   （`?.` 只挡 null/undefined），小红书那条「数据获取失败」就是这么来的
 * - `cookie === ''` 判未登录（amagi 的 qtparam）—— 传 null 时这个判断不成立，
 *   于是它按「已登录」去要 dash 流，而插件这边 checkCk() 判的是「ck 有效吗」。
 *   两边口径不一致时（ck 非空但失效）B站接口只回 dash 不回 durl，实测 durl=0、
 *   dash.video=4、dash.audio=3，未登录分支却只读 durl，最后报「请配置CooKie后重试」。
 *
 * 空白串一并算没配置：`'   '` 留在配置里会让 amagi 走「已登录」分支要 dash，
 * 表现和上面那条一模一样。
 */
const asCookieString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  // 数字是最常见的误填（把 uid、随手一串数字填进 ck 框），String() 之后交给下游，
  // 它自然会因为鉴权失败退化成未登录，而不是把整条解析链炸掉。
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

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
  update: Cfg['update']
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
    // 经 unknown 中转：CookiesConfig 现在是四个必填 string，没有索引签名，
    // 不能直接断言成 Record（TS2352）。这里要的就是「按未归一化的原始形状读」。
    const raw = this.getDefOrConfig('cookies') as unknown as Record<string, unknown>
    return {
      bilibili: asCookieString(raw.bilibili),
      douyin: asCookieString(raw.douyin),
      kuaishou: asCookieString(raw.kuaishou),
      xiaohongshu: asCookieString(raw.xiaohongshu)
    }
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

  /**
   * 读一份配置，深拷贝之后再交出去。
   *
   * 拷贝是必须的，不是防御性编程。原来这里只有一层展开（`{ ...def, ...user }`），
   * 顶层对象每次都是新的，但**嵌套的数组和对象仍然是缓存里那一份**（实测：
   * `Config.pushlist.douyin === Config.pushlist.douyin` 为真，`douyin[0]`、
   * `douyin[0].group_id` 也都为真）。而 `getYaml` 一旦把值放进 `this.config`
   * 就会一直命中它，于是原地改动的后果是「内存和磁盘从此不一致，且再也不会自愈」。
   *
   * 最贵的一条现场：`setting()` 退订时先 `group_id.splice()`，再 await 数据库、
   * 再 await 回复消息，最后才落盘。中间任何一步抛错，落盘都不会执行 —— 但缓存里
   * 那个群已经没了。实测确认：抛错后内存剩 1 个群、磁盘还是 2 个。推送从此漏掉那个群，
   * 配置文件看着完全正常，重启才恢复。这就是「推送莫名不发了」的一种来源。
   *
   * 另一条：`All()` 会把库里的 filterMode / Keywords / Tags 写进条目，写的也是缓存
   * 里那一份；之后任意一次 `Config.modify('pushlist', ...)` 就把这三个库字段一起
   * 落进了 pushlist.yaml。而 `syncFilterConfigToDb` 又拿配置里的这些值去覆盖库，
   * 形成回环 —— 用户在面板上删掉的关键词会被上一次快照重新写回去。
   *
   * 代价实测（2 万次）：app / douyin 这类小配置每次多约 3µs；50 条的 pushlist
   * 从 5.5µs 涨到 132µs。配置读取最密的地方也是「每条消息一次」或「每个推送周期一次」，
   * 而循环里那两处 pushlist 读取（push.ts 渲染列表）每轮都跟着一次网络请求，
   * 这点开销无关紧要。
   */
  getDefOrConfig<K extends ConfigName> (name: K): PluginConfigMap[K] {
    return structuredClone({ ...this.getdefSet(name), ...this.getConfig(name) })
  }

  /**
   * 缓存原件，**没有拷贝**。改它等于改所有后续读取的结果。
   * 业务代码要读配置请走 `getDefOrConfig` / `Config.<name>` 取值器。
   */
  getdefSet<K extends ConfigName> (name: K): PluginConfigMap[K] {
    return this.getYaml('default_config', name) as unknown as PluginConfigMap[K]
  }

  /** 缓存原件，**没有拷贝**。约束同 {@link getdefSet}。 */
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

    // ignoreInitial 是必须的：chokidar 5 监听一个已存在的文件时，初始扫描就会发一次 `add`
    // （实测确认）。不压掉的话下面的 add 处理会在启动时把刚建好的缓存删一遍，
    // 还顺带打一行「修改配置文件」的假日志、给 pushlist 触发一次无意义的库同步。
    const watcher = chokidar.watch(file, { ignoreInitial: true })

    /**
     * 缓存失效 + 副作用，三个事件共用。
     *
     * 原来只订阅 `change`。实测（chokidar 5 + win32）三种改法各自发的事件是：
     * - 就地覆写：`change`
     * - 写临时文件再 rename 覆盖（编辑器的原子保存）：`change`
     * - 删掉重建 / 从备份还原：`unlink` → `change` → `add`，且重建之后照样能继续收到 `change`
     *
     * 也就是说只订阅 change 在这三种路径上都能失效缓存，「热重载完全失灵」这个猜测
     * 没能复现出来。补 add / unlink 属于兜底：删掉重建那条链里的 `change` 是 chokidar
     * 重新 add 时顺带发的，依赖它的顺序不如把三个事件都接上稳妥。
     */
    const invalidate = async (event: 'change' | 'add' | 'unlink'): Promise<void> => {
      delete this.config[key]
      logger.mark(`[${Version.pluginName}][修改配置文件][${type}][${name}]`)
      // unlink 之后文件还不存在，这时候同步数据库只会拿到空表；等紧随其后的 add / change 再同步
      if (event === 'unlink') return
      if (name === 'pushlist' && type === 'config') {
        try {
          await this.syncPushlistToDatabase()
        } catch (error: unknown) {
          logger.error('[Config] 文件监听同步数据库失败:', error)
        } finally {
          await this.syncConfigToDatabase()
        }
      }
    }

    watcher.on('change', () => invalidate('change'))
    watcher.on('add', () => invalidate('add'))
    watcher.on('unlink', () => invalidate('unlink'))
    // 监听器自己出错不能静默：出错之后这个文件的热重载就等于没了，现在是一点痕迹都没有
    watcher.on('error', (error: unknown) => {
      logger.error(`[Config] 配置文件监听出错，${name}.yaml 的热重载可能已失效:`, error)
    })

    this.watcher[key] = watcher
  }

  /**
   * 改一个键并落盘。
   *
   * 返回是否真的写进去了。之前是 `void`，YamlReader 拒写（用户 yaml 解析失败时的保护）
   * 对调用方完全不可见 —— 锅巴那条路径正是把返回值丢掉后无条件回「保存成功」，
   * 用户以为 ck 存好了，实际磁盘没动，然后解析时被告知「未配置」。
   *
   * 写失败时不删缓存：文件没被改动，内存里那份仍然是对的，没必要让下次读白解析一遍。
   */
  modify<K extends ConfigName> (name: K, key: string, value: unknown, type: ConfigSource = 'config'): boolean {
    const ok = new YamlReader(this.configFile(type, name)).set(key, value)
    if (ok) delete this.config[`${type}.${name}`]
    return ok
  }

  /**
   * 读盘 → 改 → 写盘，一次做完。
   *
   * `getDefOrConfig` 改成深拷贝之后，业务代码手上的配置是快照，原地改动不再影响别人 ——
   * 但也带来一个新问题：`读快照 → await 一堆事 → Config.modify(整份数组)` 这个写法
   * 会用一份过期快照整体覆盖磁盘，把这期间别处写进去的东西抹掉。实测过：磁盘上已经有
   * 两个群，旧快照落盘之后只剩它自己知道的那一个。
   *
   * 深拷贝前这条路径**碰巧**是安全的 —— 两个并发订阅改的是同一个共享数组，所以都留了下来
   * （实测：并发订阅 A、B 两个博主，磁盘最后有两条）。这个「碰巧」正是不能只加拷贝的原因：
   * 光拷贝会把一个隐蔽的不一致换成一个明确的丢数据。
   *
   * 所以要落盘的改动走这里：拿到的 `current` 是刚从磁盘读的最新值，改完立刻写回，
   * 中间没有 await 的余地。改动函数是同步的，这一点是有意的约束。
   *
   * @param name 配置名
   * @param key 顶层键
   * @param mutate 收到磁盘上的当前值，返回要写回的新值；返回 undefined 表示放弃这次写入
   * @returns 是否真的写进了磁盘
   */
  update<K extends ConfigName, TValue> (
    name: K,
    key: string,
    mutate: (current: TValue | undefined) => TValue | undefined,
    type: ConfigSource = 'config'
  ): boolean {
    const reader = new YamlReader(this.configFile(type, name))
    // 解析失败时 document 是空文档，读出来的现状是「什么都没有」。照着它算增量
    // 等于把用户配置换成只剩这一个键，所以先问清楚能不能写，再跑改动函数。
    if (!reader.writable) {
      logger.error(`[Config] ${name}.yaml 解析失败，已跳过本次修改以保护原文件`)
      return false
    }

    // 必须走 toJS()：document.get() 交出来的是 YAMLSeq 节点，Array.isArray 为假，
    // 业务代码拿它当数组用会静默得到错的结果（实测确认）。
    // toJS() 每次都新建一份普通 JS 值，所以交给 mutate 原地改是安全的，不用再拷一次。
    const document = reader.document.toJS() as Record<string, unknown> | null
    const current = (isRecord(document) ? document[key] : undefined) as TValue | undefined

    const next = mutate(current)
    if (next === undefined) return false

    const ok = reader.set(key, next)
    if (ok) delete this.config[`${type}.${name}`]
    return ok
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
    } catch (error: unknown) {
      // 用 error 而不是 warn，并且带上原因：这条日志的后果比 warn 应有的分量重得多。
      // 解析失败时返回的 `{}` 会被 getYaml 无条件写进缓存（`isRecord({})` 为真，
      // 之后每次读都命中它），于是用户配置整份退化成默认值 —— cookies.yaml 里一处缩进写错，
      // 四个平台的 ck 就全成了 null，表现和「没配置」一模一样。
      // 这正是「我明明设了 ck」和「插件说未配置」能同时为真的一种机制，
      // 而现场只有一行 warn，太容易被划过去。
      logger.error(`[Config] 解析配置文件失败，该文件的配置已全部退回默认值: ${file}`, error)
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
