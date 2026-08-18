import { importHost } from './import-host.js'

export interface HostConfig {
  masterQQ?: Array<string | number>
  master?: Array<string | number>
}

interface HostConfigModule {
  default: HostConfig
}

const { default: config } = await importHost<HostConfigModule>('lib', 'config', 'config.js')

export default config
