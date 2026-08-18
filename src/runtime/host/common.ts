import { importHost } from './import-host.js'

export interface HostCommon {
  makeForwardMsg(event: unknown, messages: unknown[], title: string): unknown | Promise<unknown>
}

interface HostCommonModule {
  default: HostCommon
}

const { default: common } = await importHost<HostCommonModule>('lib', 'common', 'common.js')

export default common
