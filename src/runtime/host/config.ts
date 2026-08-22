import { importHost } from './import-host.js'

export interface HostConfig {
  masterQQ?: Array<string | number>
  /**
   * TRSS 是 `{ "botUin": ["masterId"] }`（见宿主 lib/config/config.js 的 `get master()`，
   * 注释就写着「Bot账号:[主人帐号]」，内部 `const masters = {}` 组装成对象返回），
   * 不是扁平数组；只有 masterQQ 的宿主（如 Miao-Yunzai）没有这个字段。
   *
   * 原来声明成数组，于是 `Array.isArray(cfg.master)` 恒为假、按 Bot 取主人的分支
   * 成了死代码，一路退化去读不带 Bot 归属的 masterQQ。
   */
  master?: Record<string, Array<string | number>> | Array<string | number>
}

interface HostConfigModule {
  default: HostConfig
}

const { default: config } = await importHost<HostConfigModule>('lib', 'config', 'config.js')

export default config
