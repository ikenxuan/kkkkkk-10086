import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import YAML from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('default configuration files', () => {
  it('all parse as non-array records with stable primitive types', async () => {
    const source = join(process.cwd(), 'config', 'default_config')
    const directory = await mkdtemp(join(tmpdir(), 'kkkkkk-default-config-'))
    temporaryDirectories.push(directory)
    await cp(source, directory, { recursive: true })

    const names = [
      'app.yaml',
      'bilibili.yaml',
      'cookies.yaml',
      'douyin.yaml',
      'kuaishou.yaml',
      'pushlist.yaml',
      'request.yaml',
      'upload.yaml',
      'xiaohongshu.yaml'
    ]
    const parsed = Object.fromEntries(await Promise.all(names.map(async name => {
      const value: unknown = YAML.parse(await readFile(join(directory, name), 'utf8'))
      expect(value, basename(name)).toBeTypeOf('object')
      expect(value, basename(name)).not.toBeNull()
      expect(Array.isArray(value), basename(name)).toBe(false)
      return [name.replace('.yaml', ''), value]
    }))) as Record<string, Record<string, unknown>>

    expect(parsed.request?.timeout).toBeTypeOf('number')
    expect(parsed.app?.priority).toBeTypeOf('number')
    expect(parsed.upload?.downloadConcurrency).toBeTypeOf('number')
    expect(parsed.app?.parseConcurrency).toBe(2)
    expect(parsed.app?.videotool).toBeTypeOf('boolean')
    expect(parsed.bilibili?.bilibilitool).toBeTypeOf('boolean')
    expect(parsed.douyin?.douyintool).toBeTypeOf('boolean')
    expect(parsed.kuaishou?.kuaishoutool).toBeTypeOf('boolean')
    expect(parsed.xiaohongshu?.switch).toBeTypeOf('boolean')
  })
})
