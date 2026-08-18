import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
const OUTPUT_FPS = 60;
const MAX_OUTPUT_WIDTH = 2160;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FONT_SIZE_MAP = {
    small: { base: 25, trackH: 30 },
    medium: { base: 32, trackH: 38 },
    large: { base: 40, trackH: 46 }
};
const SOFTWARE_ENCODERS = {
    h264: 'libx264',
    h265: 'libx265',
    av1: 'libsvtav1'
};
const SAFE_ENCODERS = new Set([
    'libx264',
    'libx265',
    'libsvtav1',
    'libaom-av1',
    'h264_nvenc',
    'hevc_nvenc',
    'av1_nvenc',
    'h264_qsv',
    'hevc_qsv',
    'av1_qsv',
    'h264_amf',
    'hevc_amf',
    'av1_amf'
]);
const isRecord = (value) => typeof value === 'object' && value !== null;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const finiteOr = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
/** Format a like count using the upstream truncating `w` convention. */
export function formatLikeCount(count) {
    if (count < 10000)
        return String(count);
    return `${(Math.floor(count / 1000) / 10).toFixed(1)}w`;
}
/** Split a danmaku line into ordered text and emoji fragments. */
export function splitDanmakuSegments(text, emojiList) {
    const orderedEmoji = [...emojiList]
        .filter(emoji => emoji.name.length > 0)
        .sort((left, right) => right.name.length - left.name.length);
    const segments = [];
    let buffer = '';
    let index = 0;
    const pushBuffer = () => {
        if (buffer.length === 0)
            return;
        segments.push({ type: 'text', content: buffer });
        buffer = '';
    };
    while (index < text.length) {
        const matched = orderedEmoji.find(emoji => text.startsWith(emoji.name, index));
        if (matched) {
            pushBuffer();
            segments.push({ type: 'emoji', name: matched.name, url: matched.url });
            index += matched.name.length;
            continue;
        }
        buffer += text[index];
        index += 1;
    }
    pushBuffer();
    return segments;
}
/** Select positive-like danmaku entries that should display a like badge. */
export function selectLikedDanmaku(sortedDanmaku) {
    const candidates = sortedDanmaku.filter(danmaku => (danmaku.digg_count ?? 0) > 0);
    const target = Math.min(50, Math.max(5, Math.round(Math.sqrt(sortedDanmaku.length) * 1.5)));
    if (candidates.length === 0) {
        return { ids: new Set(), candidateCount: 0, target };
    }
    if (candidates.length <= target) {
        return {
            ids: new Set(candidates.map(danmaku => danmaku.danmaku_id)),
            candidateCount: candidates.length,
            target
        };
    }
    const byDiggDescending = [...candidates].sort((left, right) => (right.digg_count ?? 0) - (left.digg_count ?? 0));
    const cutoff = byDiggDescending[target - 1]?.digg_count ?? 0;
    return {
        ids: new Set(byDiggDescending
            .filter(danmaku => (danmaku.digg_count ?? 0) >= cutoff)
            .map(danmaku => danmaku.danmaku_id)),
        candidateCount: candidates.length,
        target
    };
}
const readEmojiItems = (payload) => {
    if (Array.isArray(payload))
        return payload;
    if (!isRecord(payload))
        return [];
    if (Array.isArray(payload.emoji_list))
        return payload.emoji_list;
    if (isRecord(payload.data) && Array.isArray(payload.data.emoji_list)) {
        return payload.data.emoji_list;
    }
    return [];
};
const readEmojiUrl = (item) => {
    if (typeof item.url === 'string')
        return item.url;
    if (!isRecord(item.emoji_url) || !Array.isArray(item.emoji_url.url_list))
        return '';
    const firstUrl = item.emoji_url.url_list.find(value => typeof value === 'string');
    return typeof firstUrl === 'string' ? firstUrl : '';
};
/**
 * Normalize an injected Douyin emoji response. A missing or failed fetcher is
 * intentionally treated as an empty list so importing this module never starts a network request.
 */
export async function fetchDouyinEmojiList(fetcher) {
    if (!fetcher)
        return [];
    try {
        const payload = await fetcher();
        const byName = new Map();
        for (const rawItem of readEmojiItems(payload)) {
            if (!isRecord(rawItem))
                continue;
            const item = rawItem;
            const rawName = typeof item.name === 'string' ? item.name : item.display_name;
            const name = typeof rawName === 'string' ? rawName.trim() : '';
            const url = readEmojiUrl(item).trim();
            if (!name || !url || byName.has(name))
                continue;
            byName.set(name, { name, url });
        }
        return [...byName.values()].sort((left, right) => right.name.length - left.name.length);
    }
    catch {
        return [];
    }
}
const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const buildStripHtml = (segments, style, likeLabel) => {
    const content = segments.map(segment => {
        if (segment.type === 'text')
            return `<span class="text">${escapeHtml(segment.content)}</span>`;
        return `<img class="emoji" src="${escapeHtml(segment.url)}" alt="${escapeHtml(segment.name)}">`;
    }).join('');
    const badge = likeLabel === null
        ? ''
        : `<span class="like-badge"><span class="heart">♥</span>${escapeHtml(likeLabel)}</span>`;
    const fontName = escapeHtml(style.fontName);
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden}
#container{display:inline-flex;align-items:center;gap:0;white-space:nowrap;color:#fff;font-family:"${fontName}",sans-serif;font-size:${style.fontSize}px;font-weight:500;line-height:1;opacity:${style.opacity};text-shadow:0 0 2px #000,1px 1px 2px #000;padding:2px}
.text{display:inline-block}
.emoji{display:inline-block;width:1.15em;height:1.15em;object-fit:contain;vertical-align:middle;margin:0 .05em}
.like-badge{display:inline-flex;align-items:center;gap:.18em;margin-left:.3em;padding:.16em .38em;border-radius:999px;background:rgba(0,0,0,.55);font-size:.72em;text-shadow:none}
.heart{color:#fe2c55;font-size:1.1em}
</style>
</head>
<body><div id="container">${content}${badge}</div></body>
</html>`;
};
const getPngSize = (buffer) => {
    if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE))
        return {};
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width <= 0 || height <= 0)
        return {};
    return { width, height };
};
const decodeBase64 = (value) => {
    const trimmed = value.trim();
    const payload = trimmed
        .replace(/^data:image\/png;base64,/i, '')
        .replace(/^base64:\/\//i, '')
        .replace(/\s/g, '');
    if (!payload || !/^[a-z0-9+/]+={0,2}$/i.test(payload))
        return null;
    try {
        return Buffer.from(payload, 'base64');
    }
    catch {
        return null;
    }
};
const normalizePngBuffer = (value, seen = new WeakSet()) => {
    if (Buffer.isBuffer(value))
        return Buffer.from(value);
    if (typeof value === 'string')
        return decodeBase64(value);
    if (Array.isArray(value)) {
        for (const item of value) {
            const buffer = normalizePngBuffer(item, seen);
            if (buffer)
                return buffer;
        }
        return null;
    }
    if (!isRecord(value) || seen.has(value))
        return null;
    seen.add(value);
    for (const key of ['data', 'base64', 'buffer', 'file']) {
        const buffer = normalizePngBuffer(value[key], seen);
        if (buffer)
            return buffer;
    }
    return null;
};
const defaultRenderStrip = async (request) => {
    const { default: puppeteer } = await import('../../../runtime/host/puppeteer.js');
    return await puppeteer.screenshotFile('kkkkkk-10086/douyin/danmaku-strip', request.htmlPath, {
        saveId: basename(request.htmlPath, '.html'),
        imgType: 'png',
        omitBackground: true,
        pageGotoParams: { waitUntil: 'networkidle0', timeout: 15000 }
    });
};
const hasEmoji = (text, emojiList) => emojiList.some(emoji => emoji.name.length > 0 && text.includes(emoji.name));
const renderDanmakuStrip = async (text, likeLabel, emojiList, style, renderer, tempDir, namespace, cache, tempFiles) => {
    const segments = splitDanmakuSegments(text, emojiList);
    const cacheKey = JSON.stringify({ text, likeLabel, style, segments });
    const cached = cache.get(cacheKey);
    if (cached)
        return await cached;
    const pending = (async () => {
        const hash = createHash('sha256').update(cacheKey).digest('hex').slice(0, 16);
        const stem = `douyin_danmaku_${namespace}_${hash}`;
        const htmlPath = join(tempDir, `${stem}.html`);
        const pngPath = join(tempDir, `${stem}.png`);
        const html = buildStripHtml(segments, style, likeLabel);
        tempFiles.push(htmlPath, pngPath);
        try {
            await mkdir(tempDir, { recursive: true });
            await writeFile(htmlPath, html, 'utf8');
            const rendered = await renderer({
                text,
                segments,
                likeLabel,
                html,
                htmlPath,
                fontSize: style.fontSize,
                fontName: style.fontName,
                opacity: style.opacity
            });
            const pngBuffer = normalizePngBuffer(rendered);
            if (!pngBuffer)
                return null;
            const size = getPngSize(pngBuffer);
            if (!size.width || !size.height)
                return null;
            await writeFile(pngPath, pngBuffer);
            return { text, pngPath, width: size.width, height: size.height };
        }
        catch {
            return null;
        }
    })();
    cache.set(cacheKey, pending);
    return await pending;
};
const prepareDanmakuStrips = async (sortedDanmaku, emojiList, liked, style, options) => {
    const strips = new Map();
    const tempFiles = [];
    const needsStrip = (danmaku) => liked.ids.has(danmaku.danmaku_id) || hasEmoji(danmaku.text, emojiList);
    if (!sortedDanmaku.some(needsStrip))
        return { strips, tempFiles };
    const cache = new Map();
    const renderer = options.renderStrip ?? defaultRenderStrip;
    const tempDir = options.tempDir ?? tmpdir();
    const namespace = randomUUID().replace(/-/g, '').slice(0, 10);
    for (const danmaku of sortedDanmaku) {
        if (!needsStrip(danmaku))
            continue;
        const likeLabel = liked.ids.has(danmaku.danmaku_id)
            ? formatLikeCount(danmaku.digg_count ?? 0)
            : null;
        const strip = await renderDanmakuStrip(danmaku.text, likeLabel, emojiList, style, renderer, tempDir, namespace, cache, tempFiles);
        if (strip)
            strips.set(danmaku.danmaku_id, strip);
    }
    return { strips, tempFiles };
};
const toAssTime = (milliseconds) => {
    const totalSeconds = Math.max(0, milliseconds) / 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor((totalSeconds % 1) * 100);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};
const estimateWidth = (text, fontSize) => {
    let width = 0;
    for (const character of text) {
        width += character.codePointAt(0) > 127 ? fontSize : fontSize * 0.5;
    }
    return Math.max(1, width);
};
const escapeAss = (text) => text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N');
const computeDanmakuLayout = (height, danmakuArea, danmakuFontSize, danmakuOpacity) => {
    const safeHeight = Math.max(1, finiteOr(height, 1080));
    const fontScale = safeHeight / 1080;
    const size = FONT_SIZE_MAP[danmakuFontSize];
    const fontSize = Math.max(1, Math.round(size.base * fontScale));
    const trackH = Math.max(fontSize + 1, Math.round(size.trackH * fontScale));
    const topMargin = Math.max(0, Math.round(5 * fontScale));
    const areaHeight = Math.max(fontSize, Math.floor(safeHeight * clamp(danmakuArea, 0.01, 1)) - topMargin);
    const trackCount = Math.max(1, Math.floor((areaHeight - fontSize) / trackH));
    const minGap = Math.max(1, Math.round(15 * fontScale));
    const stripFontSize = Math.max(1, Math.round(fontSize * 0.75));
    const alpha = Math.round((100 - clamp(danmakuOpacity, 0, 100)) * 2.55)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
    return { fontSize, stripFontSize, trackH, topMargin, trackCount, minGap, alpha };
};
const calcTrackDistance = (previous, next, canvasWidth, minGap) => {
    const previousSpeed = (canvasWidth + previous.textWidth) / previous.duration;
    const nextSpeed = (canvasWidth + next.textWidth) / next.duration;
    const elapsed = next.startTime - previous.startTime;
    const previousRightAtEntry = canvasWidth - previousSpeed * elapsed + previous.textWidth;
    let distance = canvasWidth - previousRightAtEntry - minGap;
    if (nextSpeed > previousSpeed) {
        const elapsedAtNextEnd = next.startTime + next.duration - previous.startTime;
        const previousRightAtNextEnd = canvasWidth - previousSpeed * elapsedAtNextEnd + previous.textWidth;
        distance = Math.min(distance, -next.textWidth - previousRightAtNextEnd - minGap);
    }
    return distance;
};
const allocateTrack = (lanes, entry, canvasWidth, minGap, preferFreeLane) => {
    const freeLanes = [];
    let bestLane = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
        const lane = lanes[laneIndex];
        if (!lane)
            continue;
        let predecessorIndex = -1;
        for (let itemIndex = lane.length - 1; itemIndex >= 0; itemIndex -= 1) {
            const item = lane[itemIndex];
            if (item && item.startTime <= entry.startTime) {
                predecessorIndex = itemIndex;
                break;
            }
        }
        const predecessor = predecessorIndex >= 0 ? lane[predecessorIndex] : undefined;
        const successor = predecessorIndex + 1 < lane.length ? lane[predecessorIndex + 1] : undefined;
        const predecessorActive = predecessor !== undefined &&
            predecessor.startTime + predecessor.duration > entry.startTime;
        const successorOverlaps = successor !== undefined &&
            entry.startTime + entry.duration > successor.startTime;
        const predecessorDistance = predecessorActive
            ? calcTrackDistance(predecessor, entry, canvasWidth, minGap)
            : Number.POSITIVE_INFINITY;
        if (predecessorActive && predecessorDistance < 0)
            continue;
        if (successorOverlaps && calcTrackDistance(entry, successor, canvasWidth, minGap) < 0)
            continue;
        if (!predecessorActive && !successorOverlaps) {
            freeLanes.push(laneIndex);
            continue;
        }
        if (predecessorDistance < bestDistance) {
            bestDistance = predecessorDistance;
            bestLane = laneIndex;
        }
    }
    if (preferFreeLane && freeLanes.length > 0)
        return freeLanes[0] ?? -1;
    if (bestLane >= 0)
        return bestLane;
    return freeLanes[0] ?? -1;
};
const insertIntoLane = (lane, entry) => {
    let index = lane.length - 1;
    while (index >= 0) {
        const item = lane[index];
        if (!item || item.startTime <= entry.startTime)
            break;
        index -= 1;
    }
    lane.splice(index + 1, 0, entry);
};
const buildAssHeader = (width, height, fontName, layout) => {
    const safeFontName = fontName.replace(/[\r\n,]/g, ' ').trim() || 'Microsoft YaHei';
    return `[Script Info]
ScriptType: v4.00+
PlayResX: ${Math.round(width)}
PlayResY: ${Math.round(height)}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Scroll,${safeFontName},${layout.fontSize},&H${layout.alpha}FFFFFF,&H${layout.alpha}FFFFFF,&H${layout.alpha}000000,&H${layout.alpha}000000,0,0,0,0,100,100,0,0,1,0.8,0,2,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
};
const buildScrollDialogue = (text, entry, trackIndex, canvasWidth, layout) => {
    const y = layout.topMargin + trackIndex * layout.trackH + layout.fontSize;
    return `Dialogue: 0,${toAssTime(entry.startTime)},${toAssTime(entry.startTime + entry.duration)},Scroll,,0,0,0,,{\\an7}{\\move(${canvasWidth},${y},${-entry.textWidth},${y})}${escapeAss(text)}\n`;
};
const buildOverlay = (strip, entry, trackIndex, layout) => {
    const textTop = layout.topMargin + trackIndex * layout.trackH + layout.fontSize;
    const y = Math.max(0, Math.round(textTop + (layout.fontSize - strip.height) / 2));
    return {
        pngPath: strip.pngPath,
        startTime: entry.startTime,
        endTime: entry.startTime + entry.duration,
        y,
        moveW: entry.textWidth,
        width: strip.width,
        height: strip.height
    };
};
/** Generate plain ASS dialogue plus transparent PNG overlay descriptions. */
export async function generateDouyinASS(danmakuList, width, height, options = {}) {
    const canvasWidth = Math.max(1, Math.round(finiteOr(width, 1080)));
    const canvasHeight = Math.max(1, Math.round(finiteOr(height, 1920)));
    const scrollTime = Math.max(0.1, finiteOr(options.scrollTime, 8));
    const opacity = clamp(finiteOr(options.danmakuOpacity, 70), 0, 100);
    const area = clamp(finiteOr(options.danmakuArea, 0.5), 0.01, 1);
    const fontName = options.fontName?.trim() || 'Microsoft YaHei';
    const fontSize = options.danmakuFontSize ?? 'medium';
    const layout = computeDanmakuLayout(canvasHeight, area, fontSize, opacity);
    const sortedDanmaku = [...danmakuList]
        .filter(danmaku => typeof danmaku.text === 'string' && danmaku.text.trim().length > 0)
        .sort((left, right) => left.offset_time - right.offset_time);
    const emojiList = options.emojiList ??
        await fetchDouyinEmojiList(options.emojiFetcher ?? options.fetchEmoji);
    const liked = selectLikedDanmaku(sortedDanmaku);
    const stripStyle = {
        fontSize: layout.stripFontSize,
        fontName,
        opacity: opacity / 100
    };
    const { strips, tempFiles } = await prepareDanmakuStrips(sortedDanmaku, emojiList, liked, stripStyle, options);
    const lanes = Array.from({ length: layout.trackCount }, () => []);
    const assLines = [];
    const overlays = [];
    let likedOverlayCount = 0;
    let emojiOverlayCount = 0;
    const placeDanmaku = (danmaku, preferFreeLane) => {
        const strip = strips.get(danmaku.danmaku_id);
        const entry = {
            startTime: Math.max(0, finiteOr(danmaku.offset_time, 0)),
            duration: scrollTime * 1000,
            textWidth: strip
                ? Math.max(estimateWidth(danmaku.text, layout.fontSize), strip.width)
                : estimateWidth(danmaku.text, layout.fontSize)
        };
        const trackIndex = allocateTrack(lanes, entry, canvasWidth, layout.minGap, preferFreeLane);
        if (trackIndex < 0)
            return;
        const lane = lanes[trackIndex];
        if (!lane)
            return;
        insertIntoLane(lane, entry);
        if (strip) {
            overlays.push(buildOverlay(strip, entry, trackIndex, layout));
            if (liked.ids.has(danmaku.danmaku_id))
                likedOverlayCount += 1;
            else
                emojiOverlayCount += 1;
            return;
        }
        assLines.push(buildScrollDialogue(danmaku.text, entry, trackIndex, canvasWidth, layout));
    };
    // Submit selected likes first so dense ordinary danmaku cannot evict their badges.
    for (const danmaku of sortedDanmaku) {
        if (liked.ids.has(danmaku.danmaku_id))
            placeDanmaku(danmaku, true);
    }
    for (const danmaku of sortedDanmaku) {
        if (!liked.ids.has(danmaku.danmaku_id))
            placeDanmaku(danmaku, false);
    }
    return {
        ass: buildAssHeader(canvasWidth, canvasHeight, fontName, layout) + assLines.join(''),
        overlays,
        tempFiles,
        stats: {
            likedOverlays: likedOverlayCount,
            emojiOverlays: emojiOverlayCount,
            likedCandidates: liked.candidateCount,
            likedTarget: liked.target
        }
    };
}
const evenDimension = (value, fallback) => {
    const rounded = Math.max(2, Math.round(finiteOr(value, fallback)));
    return rounded % 2 === 0 ? rounded : rounded - 1;
};
const calculateCanvas = (originalWidth, originalHeight, verticalMode) => {
    const width = evenDimension(originalWidth, 1080);
    const height = evenDimension(originalHeight, 1920);
    if (verticalMode === 'off')
        return { width, height, isVertical: false };
    const isWide = width > height && width / height >= 1.7;
    if (verticalMode === 'standard' && !isWide) {
        return { width, height, isVertical: false };
    }
    const targetWidth = evenDimension(Math.min(isWide ? height : width, MAX_OUTPUT_WIDTH), 1080);
    const targetHeight = evenDimension(targetWidth * 16 / 9, 1920);
    return { width: targetWidth, height: targetHeight, isVertical: true };
};
const escapeFilterPath = (path) => path
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,');
const quoteCommandArgument = (value) => {
    const withoutControlCharacters = value.replace(/[\r\n\0]/g, '');
    const escaped = withoutControlCharacters.replace(/"/g, '\\"');
    return `"${escaped}"`;
};
const resolveEncoder = (encoder, codec = 'h264') => {
    if (encoder && SAFE_ENCODERS.has(encoder))
        return encoder;
    return SOFTWARE_ENCODERS[codec];
};
const buildBaseFilter = (canvas, assPath) => {
    const filters = [`fps=${OUTPUT_FPS}`];
    if (canvas.isVertical) {
        filters.push(`scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=decrease`, `pad=${canvas.width}:${canvas.height}:(ow-iw)/2:(oh-ih)/2:black`);
    }
    filters.push(`subtitles='${escapeFilterPath(assPath)}'`);
    return filters.join(',');
};
const selectCommandCwd = (videoPath, outputPath) => {
    const videoDirectory = dirname(resolve(videoPath));
    const outputDirectory = dirname(resolve(outputPath));
    return videoDirectory === outputDirectory ? videoDirectory : outputDirectory;
};
const toCommandPath = (cwd, path) => {
    const relativePath = relative(cwd, resolve(path));
    return relativePath.length > 0 ? relativePath : basename(path);
};
const planOverlayInputs = (overlays, cwd) => {
    const validOverlays = overlays.filter(overlay => overlay.pngPath.length > 0 &&
        Number.isFinite(overlay.startTime) &&
        Number.isFinite(overlay.endTime) &&
        overlay.endTime > overlay.startTime);
    const inputIndexByPath = new Map();
    const inputArguments = [];
    const inputIndices = validOverlays.map(overlay => {
        const resolvedPath = resolve(overlay.pngPath);
        const existing = inputIndexByPath.get(resolvedPath);
        if (existing !== undefined)
            return existing;
        const inputIndex = inputIndexByPath.size + 1;
        inputIndexByPath.set(resolvedPath, inputIndex);
        inputArguments.push(`-i ${quoteCommandArgument(toCommandPath(cwd, resolvedPath))}`);
        return inputIndex;
    });
    return {
        overlays: validOverlays,
        inputArguments,
        inputIndices,
        inputCount: inputIndexByPath.size
    };
};
const buildFilterComplex = (canvas, assPath, overlays, inputIndices, scrollTime) => {
    const parts = [`[0:v]${buildBaseFilter(canvas, assPath)}[base]`];
    const usageByInput = new Map();
    for (const inputIndex of inputIndices) {
        usageByInput.set(inputIndex, (usageByInput.get(inputIndex) ?? 0) + 1);
    }
    const labelsByInput = new Map();
    for (const [inputIndex, usageCount] of usageByInput) {
        if (usageCount === 1) {
            labelsByInput.set(inputIndex, [`${inputIndex}:v`]);
            continue;
        }
        const labels = Array.from({ length: usageCount }, (_, index) => `png${inputIndex}_${index}`);
        labelsByInput.set(inputIndex, labels);
        parts.push(`[${inputIndex}:v]split=${usageCount}${labels.map(label => `[${label}]`).join('')}`);
    }
    const usedByInput = new Map();
    let previousLabel = 'base';
    overlays.forEach((overlay, index) => {
        const inputIndex = inputIndices[index];
        if (inputIndex === undefined) {
            throw new Error(`Missing PNG input index for overlay ${index}`);
        }
        const used = usedByInput.get(inputIndex) ?? 0;
        usedByInput.set(inputIndex, used + 1);
        const imageLabel = labelsByInput.get(inputIndex)?.[used] ?? `${inputIndex}:v`;
        const outputLabel = index === overlays.length - 1 ? 'vout' : `v${index}`;
        const speed = ((canvas.width + Math.max(1, overlay.moveW)) / scrollTime).toFixed(3);
        const start = (Math.max(0, overlay.startTime) / 1000).toFixed(3);
        const end = (Math.max(0, overlay.endTime) / 1000).toFixed(3);
        const y = Math.max(0, Math.round(overlay.y));
        parts.push(`[${previousLabel}][${imageLabel}]overlay=x='${canvas.width}-(t-${start})*${speed}':y=${y}:enable='between(t,${start},${end})'[${outputLabel}]`);
        previousLabel = outputLabel;
    });
    return parts.join(';');
};
/** Build a deterministic FFmpeg command without executing it. */
export function buildDouyinFfmpegPlan(input) {
    const canvas = calculateCanvas(input.width, input.height, input.verticalMode ?? 'off');
    const scrollTime = Math.max(0.1, finiteOr(input.scrollTime, 8));
    const encoder = resolveEncoder(input.encoder);
    const encoderArguments = `-r ${OUTPUT_FPS} -c:v ${encoder} -preset medium -crf 23 -pix_fmt yuv420p -c:a copy`;
    const cwd = selectCommandCwd(input.videoPath, input.outputPath);
    const videoPath = toCommandPath(cwd, input.videoPath);
    const outputPath = toCommandPath(cwd, input.outputPath);
    const assPath = toCommandPath(cwd, input.assPath);
    const overlayInputs = planOverlayInputs(input.overlays, cwd);
    const simpleFilter = buildBaseFilter(canvas, assPath);
    if (overlayInputs.overlays.length === 0) {
        return {
            command: `-y -i ${quoteCommandArgument(videoPath)} -vf ${quoteCommandArgument(simpleFilter)} ${encoderArguments} ${quoteCommandArgument(outputPath)}`,
            filter: simpleFilter,
            cwd,
            tempFiles: [],
            canvas,
            overlayInputCount: 0
        };
    }
    const filterScriptPath = resolve(input.filterScriptPath ?? `${input.assPath}.filter_complex.txt`);
    const filterComplex = buildFilterComplex(canvas, assPath, overlayInputs.overlays, overlayInputs.inputIndices, scrollTime);
    return {
        command: `-y -i ${quoteCommandArgument(videoPath)} ${overlayInputs.inputArguments.join(' ')} -filter_complex_script ${quoteCommandArgument(toCommandPath(cwd, filterScriptPath))} -map "[vout]" -map "0:a?" ${encoderArguments} ${quoteCommandArgument(outputPath)}`,
        filter: filterComplex,
        filterComplex,
        filterScriptPath,
        cwd,
        tempFiles: [filterScriptPath],
        canvas,
        overlayInputCount: overlayInputs.inputCount
    };
}
const defaultFfprobeRunner = async (command, options) => {
    const { ffprobe } = await import('../../utils/FFmpeg.js');
    return await ffprobe(command, options);
};
const defaultFfmpegRunner = async (command, options) => {
    const { ffmpeg } = await import('../../utils/FFmpeg.js');
    return await ffmpeg(command, options);
};
const readCommandStdout = (result) => typeof result === 'boolean' ? '' : result.stdout ?? '';
const getDouyinResolution = async (videoPath, runner, cwd) => {
    try {
        const result = await runner(`-v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 ${quoteCommandArgument(toCommandPath(cwd, videoPath))}`, { cwd, timeout: 10_000 });
        const match = readCommandStdout(result).trim().match(/^(\d+)x(\d+)$/);
        if (match) {
            const width = Number(match[1]);
            const height = Number(match[2]);
            if (width > 0 && height > 0)
                return { width, height };
        }
    }
    catch {
        // A safe Douyin portrait fallback keeps the original-video send path available.
    }
    return { width: 1080, height: 1920 };
};
const commandSucceeded = (result) => typeof result === 'boolean' ? result : result.status === true;
const removeTemporaryFile = async (path) => {
    try {
        await rm(path, { force: true });
    }
    catch {
        // Cleanup must never change the media send result.
    }
};
/**
 * Burn generated ASS/PNG overlays with the repository FFmpeg helpers.
 * Every integration failure returns false so callers can continue sending the original video.
 */
export async function burnDouyinDanmaku(videoPath, danmakuList, outputPath, options = {}) {
    if (!existsSync(videoPath) || resolve(videoPath) === resolve(outputPath))
        return false;
    const temporaryFiles = [];
    try {
        const tempDir = options.tempDir ?? tmpdir();
        await mkdir(tempDir, { recursive: true });
        await mkdir(dirname(outputPath), { recursive: true });
        const commandCwd = selectCommandCwd(videoPath, outputPath);
        const ffprobeRunner = options.ffprobeRunner ?? defaultFfprobeRunner;
        const resolution = await getDouyinResolution(videoPath, ffprobeRunner, commandCwd);
        const canvas = calculateCanvas(resolution.width, resolution.height, options.verticalMode ?? 'off');
        const result = await generateDouyinASS(danmakuList, canvas.width, canvas.height, { ...options, tempDir });
        temporaryFiles.push(...result.tempFiles);
        const assStem = createHash('sha256')
            .update(`${videoPath}:${outputPath}:${randomUUID()}`)
            .digest('hex')
            .slice(0, 16);
        const assPath = join(tempDir, `douyin_danmaku_${assStem}.ass`);
        temporaryFiles.push(assPath);
        await writeFile(assPath, result.ass, 'utf8');
        const codec = options.videoCodec ?? 'h264';
        const filterScriptPath = join(tempDir, `douyin_danmaku_${assStem}.filter_complex.txt`);
        const plan = buildDouyinFfmpegPlan({
            videoPath,
            outputPath,
            assPath,
            filterScriptPath,
            width: resolution.width,
            height: resolution.height,
            overlays: result.overlays,
            scrollTime: options.scrollTime,
            verticalMode: options.verticalMode,
            encoder: resolveEncoder(options.encoder, codec)
        });
        temporaryFiles.push(...plan.tempFiles);
        if (plan.filterScriptPath && plan.filterComplex) {
            await writeFile(plan.filterScriptPath, plan.filterComplex, 'utf8');
        }
        const ffmpegRunner = options.ffmpegRunner ?? defaultFfmpegRunner;
        const execution = await ffmpegRunner(plan.command, { cwd: plan.cwd, timeout: 0 });
        const succeeded = commandSucceeded(execution);
        if (succeeded && options.removeSource && resolve(videoPath) !== resolve(outputPath)) {
            await removeTemporaryFile(videoPath);
        }
        return succeeded;
    }
    catch {
        return false;
    }
    finally {
        await Promise.all(temporaryFiles.map(removeTemporaryFile));
    }
}
