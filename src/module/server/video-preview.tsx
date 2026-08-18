import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import React from 'react'
import { renderToString } from 'react-dom/server'

import { PluginPath } from '../../dir.js'

export interface VideoPreviewRenderOptions {
  filename: string
  filePath: string
  videoUrl: string
  removeCache: boolean
  createdAt: number
  expireAt?: number
  eventsUrl?: string
  /** Deterministic clock hook for tests. */
  now?: () => number
  /** Optional precompiled template stylesheet override for tests/tools. */
  css?: string
}

interface VideoPreviewState {
  filename: string
  filePath: string
  videoUrl: string
  removeCache: boolean
  createdAt: number
  expireAt?: number
  eventsUrl: string
  serverNow: number
  remainingMs: number | null
  removed: boolean
}

let templateCssCache: string | undefined

const loadTemplateCss = (): string => {
  if (templateCssCache !== undefined) return templateCssCache
  const cssPath = join(PluginPath, 'lib', 'template-style.css')
  templateCssCache = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''
  return templateCssCache
}

const formatCountdown = (milliseconds: number | null): string => {
  if (milliseconds === null) return '--:--'
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

const PreviewVideoCard: React.FC<{ videoUrl: string }> = ({ videoUrl }) => (
  <div className='relative z-10 mt-10 w-full'>
    <video
      className='w-full max-h-[86vh] rounded-2xl bg-black shadow-2xl'
      controls
      preload='metadata'
      autoPlay
      loop
      muted
      playsInline
      src={videoUrl}
    />
  </div>
)

const PreviewInfoCard: React.FC<{ state: VideoPreviewState }> = ({ state }) => (
  <div
    className='relative z-10 mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'
    style={{ mixBlendMode: 'difference', color: '#ffffff' }}
  >
    <div>
      <div className='text-xs uppercase tracking-[0.2em]'>删除倒计时</div>
      <div className='mt-2 text-5xl font-semibold' id='preview-countdown'>
        {state.removeCache ? formatCountdown(state.remainingMs) : '不删除'}
      </div>
    </div>
    <a
      className='inline-flex h-10 items-center justify-center rounded-full border border-white/50 px-4 text-sm font-medium text-white backdrop-blur'
      href={state.videoUrl}
      download
    >
      下载视频
    </a>
  </div>
)

const PreviewLayout: React.FC<{ state: VideoPreviewState }> = ({ state }) => (
  <div className='relative min-h-screen bg-(--preview-bg) text-(--preview-fg)'>
    <div className='absolute inset-0 overflow-hidden'>
      <video
        className='h-full w-full object-cover blur-3xl scale-110 saturate-150 contrast-125'
        autoPlay
        loop
        muted
        playsInline
        preload='metadata'
        src={state.videoUrl}
      />
      <div className='absolute inset-0 pointer-events-none opacity-[0.35] mix-blend-overlay dark:mix-blend-soft-light'>
        <svg className='h-full w-full' xmlns='http://www.w3.org/2000/svg'>
          <defs>
            <filter id='previewNoise'>
              <feTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch' />
              <feColorMatrix type='saturate' values='0' />
              <feComponentTransfer>
                <feFuncR type='discrete' tableValues='0 1' />
                <feFuncG type='discrete' tableValues='0 1' />
                <feFuncB type='discrete' tableValues='0 1' />
              </feComponentTransfer>
              <feComponentTransfer>
                <feFuncA type='linear' slope='2' intercept='-0.5' />
              </feComponentTransfer>
            </filter>
            <mask id='previewNoiseMask'>
              <linearGradient id='previewNoiseGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
                <stop offset='0%' stopColor='white' stopOpacity='1' />
                <stop offset='15%' stopColor='white' stopOpacity='0.6' />
                <stop offset='50%' stopColor='white' stopOpacity='0.15' />
                <stop offset='85%' stopColor='white' stopOpacity='0.6' />
                <stop offset='100%' stopColor='white' stopOpacity='1' />
              </linearGradient>
              <rect width='100%' height='100%' fill='url(#previewNoiseGradient)' />
            </mask>
          </defs>
          <rect width='100%' height='100%' filter='url(#previewNoise)' mask='url(#previewNoiseMask)' fill='white' />
        </svg>
      </div>
      <div className='absolute inset-0 bg-black/35' />
    </div>
    <div className='relative z-10 w-full px-4 py-16 sm:px-6'>
      <div className='flex flex-col gap-2' style={{ mixBlendMode: 'difference', color: '#ffffff' }}>
        <h1 className='text-2xl font-semibold'>临时预览</h1>
        <p className='text-sm'>查看视频内容与删除时间</p>
      </div>
      <PreviewVideoCard videoUrl={state.videoUrl} />
      <PreviewInfoCard state={state} />
    </div>
  </div>
)

const serializeState = (state: VideoPreviewState): string =>
  JSON.stringify(state)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

/** Render the temporary video page with React, without an HTML template engine. */
export const renderVideoPreviewPage = (options: VideoPreviewRenderOptions): string => {
  const serverNow = (options.now ?? Date.now)()
  const remainingMs = options.removeCache && options.expireAt
    ? Math.max(options.expireAt - serverNow, 0)
    : null
  const state: VideoPreviewState = {
    filename: options.filename,
    filePath: options.filePath,
    videoUrl: options.videoUrl,
    removeCache: options.removeCache,
    createdAt: options.createdAt,
    expireAt: options.expireAt,
    eventsUrl: options.eventsUrl ?? '',
    serverNow,
    remainingMs,
    removed: false
  }
  const appHtml = renderToString(<PreviewLayout state={state} />)
  const serializedState = serializeState(state)
  const cssContent = options.css ?? loadTemplateCss()

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>临时预览</title>
  <style>
    * { box-sizing: border-box; }
    :root { --preview-bg: #ffffff; --preview-fg: #0f172a; --preview-muted: #64748b; }
    @media (prefers-color-scheme: dark) {
      :root { --preview-bg: #050505; --preview-fg: #e2e8f0; --preview-muted: #94a3b8; }
    }
    body { margin: 0; font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--preview-bg); color: var(--preview-fg); }
    @media (max-width: 720px) { .max-w-6xl { padding-left: 16px; padding-right: 16px; } }
  </style>
  <style>${cssContent}</style>
</head>
<body>
  <div id="app">${appHtml}</div>
  <script>
    window.__VIDEO_PREVIEW__=${serializedState};
    (() => {
      const state = window.__VIDEO_PREVIEW__ || {};
      const countdownEl = document.getElementById('preview-countdown');
      if (!countdownEl) return;
      let source = null;
      const format = (ms) => {
        const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (value) => String(value).padStart(2, '0');
        return hours > 0 ? pad(hours) + ':' + pad(minutes) + ':' + pad(seconds) : pad(minutes) + ':' + pad(seconds);
      };
      const update = (payload) => {
        if (!payload.removeCache) {
          countdownEl.textContent = '不删除';
          return;
        }
        if (payload.removed) {
          source?.close();
          source = null;
          countdownEl.textContent = '00:00';
          return;
        }
        const remaining = typeof payload.remainingMs === 'number'
          ? payload.remainingMs
          : (payload.expireAt ? Math.max(payload.expireAt - (payload.serverNow || Date.now()), 0) : null);
        countdownEl.textContent = remaining === null ? '--:--' : format(remaining);
      };
      update(state);
      if (state.eventsUrl && !state.removed) {
        source = new EventSource(state.eventsUrl);
        source.onmessage = (event) => {
          try { update(JSON.parse(event.data)); } catch {}
        };
      }
    })();
  </script>
</body>
</html>`
}
