import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { renderToString } from 'react-dom/server';
// This page is served independently from the React template bundle. Keep its
// small layout stylesheet inline so the SSR endpoint does not depend on a
// generated Tailwind file that is only available to template rendering.
const PREVIEW_LAYOUT_CSS = `
.preview-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: var(--preview-bg);
  color: var(--preview-fg);
}
.preview-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.preview-backdrop-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(24px) saturate(150%) contrast(125%);
  transform: scale(1.1);
}
.preview-noise-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.35;
  mix-blend-mode: overlay;
}
.preview-noise-svg {
  width: 100%;
  height: 100%;
}
.preview-overlay {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 35%);
}
.preview-content {
  position: relative;
  z-index: 10;
  width: 100%;
  padding: 64px 16px;
}
.preview-heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview-heading h1 {
  margin: 0;
  font-size: 2rem;
  line-height: 1.2;
  font-weight: 600;
}
.preview-heading p {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}
.preview-video-wrap {
  position: relative;
  z-index: 10;
  width: 100%;
  margin-top: 40px;
}
.preview-video {
  display: block;
  width: 100%;
  max-height: 86vh;
  border-radius: 16px;
  background: #000;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 55%);
}
.preview-info {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 48px;
}
.preview-countdown-label {
  font-size: 0.75rem;
  line-height: 1.5;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}
.preview-countdown {
  margin-top: 8px;
  font-size: 3rem;
  line-height: 1;
  font-weight: 600;
}
.preview-download {
  display: inline-flex;
  height: 40px;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  padding: 0 16px;
  border: 1px solid rgb(255 255 255 / 50%);
  border-radius: 999px;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  backdrop-filter: blur(8px);
}
.preview-download:hover {
  background: rgb(255 255 255 / 12%);
}
@media (min-width: 640px) {
  .preview-info {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
  .preview-download {
    align-self: auto;
  }
}
@media (max-width: 720px) {
  .preview-content {
    padding-right: 16px;
    padding-left: 16px;
  }
}
`;
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
const PreviewVideoCard = ({ videoUrl }) => (_jsx("div", { className: 'preview-video-wrap', children: _jsx("video", { className: 'preview-video', controls: true, preload: 'metadata', autoPlay: true, loop: true, muted: true, playsInline: true, src: videoUrl }) }));
const PreviewInfoCard = ({ state }) => (_jsxs("div", { className: 'preview-info', style: { mixBlendMode: 'difference', color: '#ffffff' }, children: [_jsxs("div", { children: [_jsx("div", { className: 'preview-countdown-label', children: "\u5220\u9664\u5012\u8BA1\u65F6" }), _jsx("div", { className: 'preview-countdown', id: 'preview-countdown', children: state.removeCache ? formatCountdown(state.remainingMs) : '不删除' })] }), _jsx("a", { className: 'preview-download', href: state.videoUrl, download: true, children: "\u4E0B\u8F7D\u89C6\u9891" })] }));
const PreviewLayout = ({ state }) => (_jsxs("div", { className: 'preview-page', children: [_jsxs("div", { className: 'preview-backdrop', children: [_jsx("video", { className: 'preview-backdrop-video', autoPlay: true, loop: true, muted: true, playsInline: true, preload: 'metadata', src: state.videoUrl }), _jsx("div", { className: 'preview-noise-layer', children: _jsxs("svg", { className: 'preview-noise-svg', xmlns: 'http://www.w3.org/2000/svg', children: [_jsxs("defs", { children: [_jsxs("filter", { id: 'previewNoise', children: [_jsx("feTurbulence", { type: 'fractalNoise', baseFrequency: '1.2', numOctaves: '3', stitchTiles: 'stitch' }), _jsx("feColorMatrix", { type: 'saturate', values: '0' }), _jsxs("feComponentTransfer", { children: [_jsx("feFuncR", { type: 'discrete', tableValues: '0 1' }), _jsx("feFuncG", { type: 'discrete', tableValues: '0 1' }), _jsx("feFuncB", { type: 'discrete', tableValues: '0 1' })] }), _jsx("feComponentTransfer", { children: _jsx("feFuncA", { type: 'linear', slope: '2', intercept: '-0.5' }) })] }), _jsxs("mask", { id: 'previewNoiseMask', children: [_jsxs("linearGradient", { id: 'previewNoiseGradient', x1: '0%', y1: '0%', x2: '0%', y2: '100%', children: [_jsx("stop", { offset: '0%', stopColor: 'white', stopOpacity: '1' }), _jsx("stop", { offset: '15%', stopColor: 'white', stopOpacity: '0.6' }), _jsx("stop", { offset: '50%', stopColor: 'white', stopOpacity: '0.15' }), _jsx("stop", { offset: '85%', stopColor: 'white', stopOpacity: '0.6' }), _jsx("stop", { offset: '100%', stopColor: 'white', stopOpacity: '1' })] }), _jsx("rect", { width: '100%', height: '100%', fill: 'url(#previewNoiseGradient)' })] })] }), _jsx("rect", { width: '100%', height: '100%', filter: 'url(#previewNoise)', mask: 'url(#previewNoiseMask)', fill: 'white' })] }) }), _jsx("div", { className: 'preview-overlay' })] }), _jsxs("div", { className: 'preview-content', children: [_jsxs("div", { className: 'preview-heading', style: { mixBlendMode: 'difference', color: '#ffffff' }, children: [_jsx("h1", { children: "\u4E34\u65F6\u9884\u89C8" }), _jsx("p", { children: "\u67E5\u770B\u89C6\u9891\u5185\u5BB9\u4E0E\u5220\u9664\u65F6\u95F4" })] }), _jsx(PreviewVideoCard, { videoUrl: state.videoUrl }), _jsx(PreviewInfoCard, { state: state })] })] }));
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
    const cssContent = [PREVIEW_LAYOUT_CSS, options.css].filter(Boolean).join('\n');
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
