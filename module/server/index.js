import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import {
  createBilibiliRoutes,
  createDouyinRoutes,
  createKuaishouRoutes,
  createXiaohongshuRoutes
} from '@ikenxuan/amagi'
import Config from '../utils/Config.js'
import Common from '../utils/Common.js'
import Version from '../utils/Version.js'
import { sendNotFound } from './response.js'

let serverInstance = null

const KKK_PREFIX = '/kkk'
const API_PREFIX = `${KKK_PREFIX}/v1`
const SSR_PREFIX = `${KKK_PREFIX}/ssr`

const renderVideoPreviewPage = (data) => {
  const templatePath = path.join(Version.pluginPath, 'resources', 'template', 'videoView', 'index.html')
  const template = fs.readFileSync(templatePath, 'utf8')
  return template
    .replaceAll('{{filename}}', data.filename)
    .replaceAll('{{videoDataUrl}}', data.videoDataUrl)
}

const getSafeFilename = (req) => {
  const raw = req.params.filename
  const filename = Array.isArray(raw) ? raw[0] : raw
  return filename ? path.basename(filename) : ''
}

const streamVideo = (req, res) => {
  const filename = getSafeFilename(req)
  const videoPath = Common.validateVideoRequest(filename)
  if (!videoPath) return sendNotFound(res, '视频文件不存在或文件名非法')

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

const renderVideoPage = (req, res) => {
  const filename = getSafeFilename(req)
  const videoPath = Common.validateVideoRequest(filename)
  if (!videoPath) return sendNotFound(res, '视频文件不存在或文件名非法')

  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(renderVideoPreviewPage({
    filename,
    videoDataUrl: `${API_PREFIX}/stream/${encodeURIComponent(filename)}`
  }))
}

const videoEvents = (req, res) => {
  const filename = getSafeFilename(req)
  const info = Common.getVideoPreview(filename)
  if (!info) return sendNotFound(res, '预览信息不存在')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const sendPayload = () => {
    const current = Common.getVideoPreview(filename) || info
    const now = Date.now()
    const remainingMs = current.expireAt ? Math.max(current.expireAt - now, 0) : null
    const removed = Boolean(current.removedAt) || !fs.existsSync(current.filePath)
    if (removed && !current.removedAt) Common.markVideoPreviewRemoved(filename)
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

const mountAmagiRoutes = (app) => {
  const cookies = Config.amagi?.cookies || Config.cookies || {}
  app.use('/amagi/api/bilibili', createBilibiliRoutes(cookies.bilibili))
  app.use('/amagi/api/douyin', createDouyinRoutes(cookies.douyin))
  app.use('/amagi/api/kuaishou', createKuaishouRoutes(cookies.kuaishou))
  app.use('/amagi/api/xiaohongshu', createXiaohongshuRoutes(cookies.xiaohongshu))

  app.use('/api/bilibili', createBilibiliRoutes(cookies.bilibili))
  app.use('/api/douyin', createDouyinRoutes(cookies.douyin))
  app.use('/api/kuaishou', createKuaishouRoutes(cookies.kuaishou))
  app.use('/api/xiaohongshu', createXiaohongshuRoutes(cookies.xiaohongshu))
}

const createPluginServer = () => {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  mountAmagiRoutes(app)

  app.get(`${API_PREFIX}/stream/:filename`, streamVideo)
  app.get(`${API_PREFIX}/video/:filename/events`, videoEvents)
  app.get(`${SSR_PREFIX}/video/:filename`, renderVideoPage)

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

export const startPluginServer = () => {
  if (serverInstance) return serverInstance

  const port = Number(Config.amagi?.APIServerPort || Config.app.APIServerPort || 4567)
  const app = createPluginServer()
  serverInstance = app.listen(port, () => {
    logger.info(`[${Version.pluginName}] API 服务已启动：http://127.0.0.1:${port}`)
    logger.info(`[${Version.pluginName}] 视频预览：http://127.0.0.1:${port}${SSR_PREFIX}/video/<filename>`)
  })
  serverInstance.on('error', error => {
    logger.error(`[${Version.pluginName}] API 服务启动失败`, error)
  })
  return serverInstance
}
