import { importHost } from './import-host.js'

export interface HostUpdateInstance {
  e: unknown
  update(): unknown
  updateLog(): unknown
}

export interface HostUpdateConstructor {
  new (event: unknown): HostUpdateInstance
}

interface HostUpdateModule {
  update: HostUpdateConstructor
}

const { update } = await importHost<HostUpdateModule>('plugins', 'other', 'update.js')

export { update }
