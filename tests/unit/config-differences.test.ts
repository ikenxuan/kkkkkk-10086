import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import YAML from 'yaml'
import { describe, expect, it } from 'vitest'
import type {
  AppConfig,
  BilibiliDynamicType,
  BilibiliPushConfig
} from '../../src/types/config.js'

const readDefaultConfig = async (name: 'app' | 'bilibili'): Promise<Record<string, unknown>> =>
  YAML.parse(await readFile(join(process.cwd(), 'config', 'default_config', `${name}.yaml`), 'utf8')) as Record<string, unknown>

describe('v2.42 default configuration differences', () => {
  it('ships the three supported Bilibili dynamic types as the parse allow-list', async () => {
    const expected: BilibiliDynamicType[] = [
      'DYNAMIC_TYPE_AV',
      'DYNAMIC_TYPE_DRAW',
      'DYNAMIC_TYPE_ARTICLE'
    ]
    const typedConfig: BilibiliPushConfig = { parseDynamicTypes: expected }
    const config = await readDefaultConfig('bilibili')
    const push = config.push as Record<string, unknown>

    expect(typedConfig.parseDynamicTypes).toEqual(expected)
    expect(push.parseDynamicTypes).toEqual(expected)
  })

  it('ships intelligent theme and ambient-cover defaults', async () => {
    const typedConfig: AppConfig = {
      Theme: 3,
      ambientCover: {
        coverOpacity: 0.7,
        overlayEdgeOpacity: 0.9,
        overlayMiddleOpacity: 0.2
      }
    }
    const config = await readDefaultConfig('app')

    expect(typedConfig.Theme).toBe(3)
    expect(typedConfig.ambientCover).toEqual({
      coverOpacity: 0.7,
      overlayEdgeOpacity: 0.9,
      overlayMiddleOpacity: 0.2
    })
    expect(config.ambientCover).toEqual({
      coverOpacity: 0.7,
      overlayEdgeOpacity: 0.9,
      overlayMiddleOpacity: 0.2
    })
  })
})
