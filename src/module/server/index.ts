import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Server } from 'node:http'
import cors from 'cors'
import express, {
  type Express,
  type Request,
  type RequestHandler,
  type Response
} from 'express'
import Config from '@/module/utils/Config'
import Common from '@/module/utils/Common'
import Version from '@/module/utils/Version'
import { sendNotFound } from './response.js'
import { renderVideoPreviewPage } from './video-preview.js'

interface VideoPreview {
  filename: string
  filePath: string
  removeCache: boolean
  createdAt: number
  expireAt?: number
  removedAt?: number
}

interface VideoPreviewDependencies {
  validateVideoRequest: (filename: string) => string | null
  getVideoPreview: (filename: string) => VideoPreview | undefined
  markVideoPreviewRemoved: (filename: string) => void
}

interface AmagiRouteFactories {
  createBilibiliRoutes: (cookie?: string | null) => RequestHandler
  createDouyinRoutes: (cookie?: string | null) => RequestHandler
  createKuaishouRoutes: (cookie?: string | null) => RequestHandler
  createXiaohongshuRoutes: (cookie?: string | null) => RequestHandler
}

interface PluginServerDependencies extends Partial<VideoPreviewDependencies> {
  amagiRoutes?: AmagiRouteFactories
}

interface StartPluginServerOptions extends PluginServerDependencies {
  port?: number
}

const require = createRequire(import.meta.url)
let serverInstance: Server | null = null
let defaultAmagiRoutes: AmagiRouteFactories | undefined

const getDefaultAmagiRoutes = (): AmagiRouteFactories => {
  defaultAmagiRoutes ||= require('@ikenxuan/amagi') as AmagiRouteFactories
  return defaultAmagiRoutes
}

const KKK_PREFIX = '/kkk'
const API_PREFIX = `${KKK_PREFIX}/v1`
const SSR_PREFIX = `${KKK_PREFIX}/ssr`

const defaultDependencies: VideoPreviewDependencies = {
  validateVideoRequest: filename => Common.validateVideoRequest(filename),
  getVideoPreview: filename => Common.getVideoPreview(filename),
  markVideoPreviewRemoved: filename => Common.markVideoPreviewRemoved(filename)
}

const getSafeFilename = (req: Request): string => {
  const raw = req.params.filename
  const filename = Array.isArray(raw) ? raw[0] : raw
  return filename ? path.basename(filename) : ''
}

const createStreamVideo = (dependencies: VideoPreviewDependencies) => (
  req: Request,
  res: Response
): void => {
  const filename = getSafeFilename(req)
  const videoPath = dependencies.validateVideoRequest(filename)
  if (!videoPath) {
    sendNotFound(res, '视频文件不存在或文件名非法')
    return
  }

  const stat = fs.statSync(videoPath)
  const range = req.headers.range
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', 'video/mp4')

  if (!range) {
    res.setHeader('Content-Length', stat.size)
    fs.createReadStream(videoPath).pipe(res)
    return
  }

  const [startText, endText] = range.replace(/bytes=/, '').split('-')
  const start = Number.parseInt(startText || '0', 10)
  const end = endText ? Number.parseInt(endText, 10) : stat.size - 1
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= stat.size) {
    res.status(416).send('请求范围不满足')
    return
  }

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
    'Content-Length': end - start + 1,
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes'
  })
  fs.createReadStream(videoPath, { start, end }).pipe(res)
}

const createRenderVideoPage = (dependencies: VideoPreviewDependencies) => (
  req: Request,
  res: Response
): void => {
  const filename = getSafeFilename(req)
  const videoPath = dependencies.validateVideoRequest(filename)
  if (!videoPath) {
    sendNotFound(res, '视频文件不存在或文件名非法')
    return
  }

  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  const preview = dependencies.getVideoPreview(filename)
  const removeCache = preview?.removeCache ?? Boolean(Config.app.removeCache)
  const createdAt = preview?.createdAt ?? Date.now()
  const expireAt = preview?.expireAt ?? (removeCache ? createdAt + 10 * 60 * 1000 : undefined)
  res.send(renderVideoPreviewPage({
    filename,
    filePath: preview?.filePath ?? videoPath,
    videoUrl: `${API_PREFIX}/stream/${encodeURIComponent(filename)}`,
    removeCache,
    createdAt,
    expireAt,
    eventsUrl: `${API_PREFIX}/video/${encodeURIComponent(filename)}/events`
  }))
}

const createVideoEvents = (dependencies: VideoPreviewDependencies) => (
  req: Request,
  res: Response
): void => {
  const filename = getSafeFilename(req)
  const info = dependencies.getVideoPreview(filename)
  if (!info) {
    sendNotFound(res, '预览信息不存在')
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendPayload = (): boolean => {
    const current = dependencies.getVideoPreview(filename) || info
    const now = Date.now()
    const remainingMs = current.expireAt ? Math.max(current.expireAt - now, 0) : null
    const removed = Boolean(current.removedAt) || !fs.existsSync(current.filePath)
    if (removed && !current.removedAt) dependencies.markVideoPreviewRemoved(filename)
    res.write(`data: ${JSON.stringify({ ...current, remainingMs, removed, serverNow: now })}\n\n`)
    return removed
  }

  if (sendPayload()) {
    res.end()
    return
  }

  const timer = setInterval(() => {
    if (sendPayload()) {
      clearInterval(timer)
      res.end()
    }
  }, 1000)

  res.on('close', () => clearInterval(timer))
}

const mountAmagiRoutes = (
  app: Express,
  routes: AmagiRouteFactories
): void => {
  const cookies = Config.amagi?.cookies || Config.cookies || {}
  app.use('/amagi/api/bilibili', routes.createBilibiliRoutes(cookies.bilibili))
  app.use('/amagi/api/douyin', routes.createDouyinRoutes(cookies.douyin))
  app.use('/amagi/api/kuaishou', routes.createKuaishouRoutes(cookies.kuaishou))
  app.use('/amagi/api/xiaohongshu', routes.createXiaohongshuRoutes(cookies.xiaohongshu))

  app.use('/api/bilibili', routes.createBilibiliRoutes(cookies.bilibili))
  app.use('/api/douyin', routes.createDouyinRoutes(cookies.douyin))
  app.use('/api/kuaishou', routes.createKuaishouRoutes(cookies.kuaishou))
  app.use('/api/xiaohongshu', routes.createXiaohongshuRoutes(cookies.xiaohongshu))
}

export const createPluginServer = (
  overrides: PluginServerDependencies = {}
): Express => {
  const {
    amagiRoutes = getDefaultAmagiRoutes(),
    ...videoOverrides
  } = overrides
  const dependencies = { ...defaultDependencies, ...videoOverrides }
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  mountAmagiRoutes(app, amagiRoutes)

  app.get(`${API_PREFIX}/stream/:filename`, createStreamVideo(dependencies))
  app.get(`${API_PREFIX}/video/:filename/events`, createVideoEvents(dependencies))
  app.get(`${SSR_PREFIX}/video/:filename`, createRenderVideoPage(dependencies))

  app.get(KKK_PREFIX, (_req, res) => {
    res.json({
      ok: true,
      plugin: Version.pluginName,
      version: Version.version,
      message: 'Web 配置面板已迁移到锅巴面板'
    })
  })

  app.get(`${KKK_PREFIX}/health`, (_req, res) => {
    res.json({ ok: true, plugin: Version.pluginName, version: Version.version })
  })

  return app
}

export const startPluginServer = (
  options: StartPluginServerOptions = {}
): Server => {
  if (serverInstance) return serverInstance

  const {
    port = Number(Config.amagi?.APIServerPort || Config.app.APIServerPort || 4567),
    ...dependencies
  } = options
  const app = createPluginServer(dependencies)
  serverInstance = app.listen(port, () => {
    logger.info(`[${Version.pluginName}] API 服务已启动：http://127.0.0.1:${port}`)
    logger.info(`[${Version.pluginName}] 视频预览：http://127.0.0.1:${port}${SSR_PREFIX}/video/<filename>`)
  })
  serverInstance.on('error', error => {
    logger.error(`[${Version.pluginName}] API 服务启动失败`, error)
  })
  return serverInstance
}
