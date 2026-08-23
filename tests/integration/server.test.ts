import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import express from 'express'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/module/utils/Config.js', () => ({
  default: {
    amagi: { cookies: {} },
    cookies: {},
    app: {}
  }
}))

vi.mock('../../src/module/utils/Common.js', () => ({
  default: {
    validateVideoRequest: () => null,
    getVideoPreview: () => undefined,
    markVideoPreviewRemoved: () => {}
  }
}))

const routeFactories = {
  createBilibiliRoutes: () => express.Router(),
  createDouyinRoutes: () => express.Router(),
  createKuaishouRoutes: () => express.Router(),
  createXiaohongshuRoutes: () => express.Router()
}

let serverModule: typeof import('../../src/module/server/index.js')
const temporaryDirectories: string[] = []

const closeServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
}

const createVideoApp = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kkkkkk-server-'))
  temporaryDirectories.push(directory)
  const videoPath = join(directory, 'preview.mp4')
  await writeFile(videoPath, Buffer.from('0123456789'))

  return serverModule.createPluginServer({
    amagiRoutes: routeFactories,
    validateVideoRequest: filename => filename === 'preview.mp4' ? videoPath : null,
    getVideoPreview: () => undefined,
    markVideoPreviewRemoved: () => {}
  })
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async directory => {
    await rm(directory, { recursive: true, force: true })
  }))
})

beforeAll(async () => {
  serverModule = await import('../../src/module/server/index.js')
})

describe('createPluginServer', () => {
  it('creates an app without listening and serves the health route', async () => {
    const app = serverModule.createPluginServer({ amagiRoutes: routeFactories })
    const listenSpy = vi.spyOn(app, 'listen')

    expect(listenSpy).not.toHaveBeenCalled()
    const server = app.listen(0)

    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('server did not bind a TCP port')
      const response = await fetch(`http://127.0.0.1:${address.port}/kkk/health`)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        ok: true,
        plugin: 'kkkkkk-10086',
        // 不写死版本号：这里要证明的是 health 路由把插件版本报出来了，
        // 不是某个具体版本。写死会让每次 release-please 撞版本号都挂一次。
        version: JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version
      })
      expect(listenSpy).toHaveBeenCalledTimes(1)
    } finally {
      await closeServer(server)
    }
  })

  it('serves the complete registered video without a Range header', async () => {
    const app = await createVideoApp()
    const server = app.listen(0)

    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('server did not bind a TCP port')
      const response = await fetch(`http://127.0.0.1:${address.port}/kkk/v1/stream/preview.mp4`)

      expect(response.status).toBe(200)
      expect(response.headers.get('accept-ranges')).toBe('bytes')
      expect(response.headers.get('content-length')).toBe('10')
      expect(await response.text()).toBe('0123456789')
    } finally {
      await closeServer(server)
    }
  })

  it('serves an isolated registered video through byte ranges', async () => {
    const app = await createVideoApp()
    const server = app.listen(0)

    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('server did not bind a TCP port')
      const response = await fetch(`http://127.0.0.1:${address.port}/kkk/v1/stream/preview.mp4`, {
        headers: { Range: 'bytes=2-5' }
      })

      expect(response.status).toBe(206)
      expect(response.headers.get('content-range')).toBe('bytes 2-5/10')
      expect(await response.text()).toBe('2345')
    } finally {
      await closeServer(server)
    }
  })

  it('rejects a byte range that extends beyond the video', async () => {
    const app = await createVideoApp()
    const server = app.listen(0)

    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('server did not bind a TCP port')
      const response = await fetch(`http://127.0.0.1:${address.port}/kkk/v1/stream/preview.mp4`, {
        headers: { Range: 'bytes=8-12' }
      })

      expect(response.status).toBe(416)
      expect(await response.text()).toBe('请求范围不满足')
    } finally {
      await closeServer(server)
    }
  })

  it('returns 404 for an unregistered filename', async () => {
    const app = await createVideoApp()
    const server = app.listen(0)

    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('server did not bind a TCP port')
      const response = await fetch(`http://127.0.0.1:${address.port}/kkk/v1/stream/not-registered.mp4`)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({
        success: false,
        code: 404,
        message: '视频文件不存在或文件名非法'
      })
    } finally {
      await closeServer(server)
    }
  })
})

describe('startPluginServer', () => {
  it('returns the same listener without mounting routes twice', async () => {
    const singletonRoutes = {
      createBilibiliRoutes: vi.fn(() => express.Router()),
      createDouyinRoutes: vi.fn(() => express.Router()),
      createKuaishouRoutes: vi.fn(() => express.Router()),
      createXiaohongshuRoutes: vi.fn(() => express.Router())
    }

    const first = serverModule.startPluginServer({
      amagiRoutes: singletonRoutes,
      port: 0
    })

    try {
      const second = serverModule.startPluginServer({
        amagiRoutes: singletonRoutes,
        port: 0
      })

      expect(second).toBe(first)
      expect(singletonRoutes.createBilibiliRoutes).toHaveBeenCalledTimes(2)
      expect(singletonRoutes.createDouyinRoutes).toHaveBeenCalledTimes(2)
      expect(singletonRoutes.createKuaishouRoutes).toHaveBeenCalledTimes(2)
      expect(singletonRoutes.createXiaohongshuRoutes).toHaveBeenCalledTimes(2)
    } finally {
      await closeServer(first)
    }
  })
})
