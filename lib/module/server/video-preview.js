import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PluginPath } from '../../dir.js';
let templateCssCache;
const loadTemplateCss = () => {
    if (templateCssCache !== undefined)
        return templateCssCache;
    const cssPath = join(PluginPath, 'lib', 'template-style.css');
    templateCssCache = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
    return templateCssCache;
};
const formatCountdown = (milliseconds) => {
    if (milliseconds === null)
        return '--:--';
    const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value) => String(value).padStart(2, '0');
    return hours > 0
        ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`;
};
const PreviewVideoCard = ({ videoUrl }) => (_jsx("div", { className: 'relative z-10 mt-10 w-full', children: _jsx("video", { className: 'w-full max-h-[86vh] rounded-2xl bg-black shadow-2xl', controls: true, preload: 'metadata', autoPlay: true, loop: true, muted: true, playsInline: true, src: videoUrl }) }));
const PreviewInfoCard = ({ state }) => (_jsxs("div", { className: 'relative z-10 mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', style: { mixBlendMode: 'difference', color: '#ffffff' }, children: [_jsxs("div", { children: [_jsx("div", { className: 'text-xs uppercase tracking-[0.2em]', children: "\u5220\u9664\u5012\u8BA1\u65F6" }), _jsx("div", { className: 'mt-2 text-5xl font-semibold', id: 'preview-countdown', children: state.removeCache ? formatCountdown(state.remainingMs) : '不删除' })] }), _jsx("a", { className: 'inline-flex h-10 items-center justify-center rounded-full border border-white/50 px-4 text-sm font-medium text-white backdrop-blur', href: state.videoUrl, download: true, children: "\u4E0B\u8F7D\u89C6\u9891" })] }));
const PreviewLayout = ({ state }) => (_jsxs("div", { className: 'relative min-h-screen bg-(--preview-bg) text-(--preview-fg)', children: [_jsxs("div", { className: 'absolute inset-0 overflow-hidden', children: [_jsx("video", { className: 'h-full w-full object-cover blur-3xl scale-110 saturate-150 contrast-125', autoPlay: true, loop: true, muted: true, playsInline: true, preload: 'metadata', src: state.videoUrl }), _jsx("div", { className: 'absolute inset-0 pointer-events-none opacity-[0.35] mix-blend-overlay dark:mix-blend-soft-light', children: _jsxs("svg", { className: 'h-full w-full', xmlns: 'http://www.w3.org/2000/svg', children: [_jsxs("defs", { children: [_jsxs("filter", { id: 'previewNoise', children: [_jsx("feTurbulence", { type: 'fractalNoise', baseFrequency: '1.2', numOctaves: '3', stitchTiles: 'stitch' }), _jsx("feColorMatrix", { type: 'saturate', values: '0' }), _jsxs("feComponentTransfer", { children: [_jsx("feFuncR", { type: 'discrete', tableValues: '0 1' }), _jsx("feFuncG", { type: 'discrete', tableValues: '0 1' }), _jsx("feFuncB", { type: 'discrete', tableValues: '0 1' })] }), _jsx("feComponentTransfer", { children: _jsx("feFuncA", { type: 'linear', slope: '2', intercept: '-0.5' }) })] }), _jsxs("mask", { id: 'previewNoiseMask', children: [_jsxs("linearGradient", { id: 'previewNoiseGradient', x1: '0%', y1: '0%', x2: '0%', y2: '100%', children: [_jsx("stop", { offset: '0%', stopColor: 'white', stopOpacity: '1' }), _jsx("stop", { offset: '15%', stopColor: 'white', stopOpacity: '0.6' }), _jsx("stop", { offset: '50%', stopColor: 'white', stopOpacity: '0.15' }), _jsx("stop", { offset: '85%', stopColor: 'white', stopOpacity: '0.6' }), _jsx("stop", { offset: '100%', stopColor: 'white', stopOpacity: '1' })] }), _jsx("rect", { width: '100%', height: '100%', fill: 'url(#previewNoiseGradient)' })] })] }), _jsx("rect", { width: '100%', height: '100%', filter: 'url(#previewNoise)', mask: 'url(#previewNoiseMask)', fill: 'white' })] }) }), _jsx("div", { className: 'absolute inset-0 bg-black/35' })] }), _jsxs("div", { className: 'relative z-10 w-full px-4 py-16 sm:px-6', children: [_jsxs("div", { className: 'flex flex-col gap-2', style: { mixBlendMode: 'difference', color: '#ffffff' }, children: [_jsx("h1", { className: 'text-2xl font-semibold', children: "\u4E34\u65F6\u9884\u89C8" }), _jsx("p", { className: 'text-sm', children: "\u67E5\u770B\u89C6\u9891\u5185\u5BB9\u4E0E\u5220\u9664\u65F6\u95F4" })] }), _jsx(PreviewVideoCard, { videoUrl: state.videoUrl }), _jsx(PreviewInfoCard, { state: state })] })] }));
const serializeState = (state) => JSON.stringify(state)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
/** Render the temporary video page with React, without an HTML template engine. */
export const renderVideoPreviewPage = (options) => {
    const serverNow = (options.now ?? Date.now)();
    const remainingMs = options.removeCache && options.expireAt
        ? Math.max(options.expireAt - serverNow, 0)
        : null;
    const state = {
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
    };
    const appHtml = renderToString(_jsx(PreviewLayout, { state: state }));
    const serializedState = serializeState(state);
    const cssContent = options.css ?? loadTemplateCss();
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
</html>`;
};
