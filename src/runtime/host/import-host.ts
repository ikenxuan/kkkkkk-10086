import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ClientPath } from '../../dir.js'

export async function importHost<T> (...segments: string[]): Promise<T> {
  const url = pathToFileURL(join(ClientPath, ...segments)).href
  return await import(url) as T
}
