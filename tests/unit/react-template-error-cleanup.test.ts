import { expect, it, vi } from 'vitest'

const cleanup = vi.hoisted(() => vi.fn(async () => {
  throw Object.assign(new Error('private render directory and data'), { code: 'EACCES' })
}))
vi.mock('node:fs', () => ({ existsSync: () => false, statSync: vi.fn() }))
vi.mock('../../src/module/utils/cache/runtime.js', () => ({
  createRenderCacheWorkspace: async () => ({ path: '/test/owned-render', cleanup })
}))

import { renderReactTemplate } from '../../src/module/utils/react-template/registry.js'

it('keeps the SSR loading failure when cleanup also fails and only logs an error code', async () => {
  const warn = vi.fn()
  vi.stubGlobal('logger', { warn })
  try {
    await expect(renderReactTemplate('other/help', {}, { scale: 1 })).rejects.toThrow('React standalone 模板构建不存在')
    expect(cleanup).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith('[缓存清理] 失败摘要: EACCES，等待后续重试')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private')
  } finally {
    vi.unstubAllGlobals()
  }
})
