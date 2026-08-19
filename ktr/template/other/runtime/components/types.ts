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
