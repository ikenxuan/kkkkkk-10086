/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * 运行环境诊断海报属性。
 *
 * 所有字段均由 core 在消息触发时采集，模板只负责展示经过脱敏的可序列化数据。
 */
export interface RuntimeReportData {
  /** 快照生成时间 */
  snapshotAt: string
  /** 插件、框架与构建身份 */
  identity: {
    pluginName: string
    pluginVersion: string
    karinVersion: string
    releaseType: 'Stable' | 'Preview' | 'Dev'
    requiredNodeVersion: string
    requiredKarinVersion: string
  }
  /** 当前构建指纹 */
  build: {
    state: RuntimeBuildState
    version?: string
    buildTime?: string
    shortCommitHash?: string
  }
  /** Node.js 与操作系统运行时 */
  runtime: {
    nodeVersion: string
    nodeEnv: string
    os: string
    platform: string
    arch: string
    timezone: string
    container: boolean
    systemUptime: string
    processUptime: string
  }
  /** 当前消息所使用的适配器 */
  adapter: {
    name: string
    version: string
    platform: string
    protocol: string
    standard: string
    communication: string
    connectedFor: string
  }
  /** 截图渲染配置 */
  renderer: {
    scale: string
    timeout: string
    multiPage: boolean
  }
  /** 不含主机身份信息的资源快照 */
  resources: {
    cpuModel: string
    cpuCores: number
    totalMemory: string
    usedMemory: string
    memoryUsagePercent: string
    processRss: string
    heapUsed: string
  }
  /** 接口缓存与下载额度的并发快照 */
  concurrency: {
    /** amagi 接口响应缓存 */
    cache: {
      /** `app.cacheEnabled` 的当前值 */
      enabled: boolean
      /** 是否已经产生过至少一次可缓存的查询。false 时命中率无意义，模板应改写文案 */
      sampled: boolean
      /** 已格式化的百分数，例如 `87.5%`。模板会直接当进度条宽度用 */
      hitRate: string
      /** 直接命中缓存的次数 */
      hits: number
      /** 并发合并到别人的请求上、因此没有打接口的次数 */
      coalesced: number
      /** 真的打了接口的次数 */
      misses: number
      /** 当前缓存条目数 */
      entries: number
      /** 条目上限 */
      capacity: number
      /** 当前持有的失败缓存条目数，风控期间会抬头 */
      negativeEntries: number
      /** 当前正在飞的请求数 */
      inflight: number
      /** 按 TTL 档位分开的命中情况 */
      tiers: Array<{
        /** 档位中文名，例如「准静态接口」 */
        label: string
        /** 该档位的命中率百分数 */
        hitRate: string
        /** 该档位的明细文本，已在 core 拼好 */
        detail: string
      }>
    }
    /** 下载额度占用 */
    download: {
      /** 每个桶共用的额度上限 */
      limit: number
      /** 已经出现过的桶。一次下载都没跑过时为空数组 */
      buckets: Array<{
        /** 桶的中文名，例如「抖音」 */
        label: string
        /** 当前占用的额度数 */
        running: number
        /** 正在排队等额度的数量 */
        queued: number
      }>
    }
    /**
     * 解析队列占用。
     *
     * 刻意没有指纹列表：指纹由平台 + 作品链接 + 群号拼成，而这张卡的前提是
     * 群聊触发也不会把用户数据画进图里。
     */
    parse: {
      /** 协调器有没有登记。false 时下面四个数都是 0，模板应写「未初始化」而不是画 0 */
      available: boolean
      /** 允许同时跑的解析数，来自 `app.parseConcurrency` */
      concurrency: number
      /** 正在跑的解析数 */
      running: number
      /** 在队列里等额度的解析数 */
      queued: number
      /** 在跑 + 排队，也是去重的判据（同一指纹再来会挂到已有的那个上） */
      pending: number
    }
  }
  /** 当前插件版本的变更日志 */
  releaseNotes: {
    markdown: string
    available: boolean
  }
}

/**
 * 构建指纹状态：matched=与当前版本一致；mismatched=不一致；unavailable=无构建元数据。
 */
export type RuntimeBuildState = 'matched' | 'mismatched' | 'unavailable'
