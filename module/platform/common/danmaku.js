import fs from 'fs'
import { ffmpeg, ffprobe } from '../../utils/FFmpeg.js'

const FONT_SIZE = {
  small: { size: 28, track: 38 },
  medium: { size: 36, track: 48 },
  large: { size: 46, track: 60 }
}

const escapeAss = text => String(text || '')
  .replace(/\\/g, '\\\\')
  .replace(/\{/g, '\\{')
  .replace(/\}/g, '\\}')
  .replace(/\r?\n/g, ' ')

const secondsToAssTime = seconds => {
  const safe = Math.max(0, Number(seconds) || 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const wholeSeconds = Math.floor(safe % 60)
  const centiseconds = Math.floor((safe - Math.floor(safe)) * 100)
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

const normalizeFilterPath = filepath => filepath
  .replace(/\\/g, '/')
  .replace(/^([A-Za-z]):/, '$1\\:')
  .replace(/'/g, "\\'")

const getVideoResolution = async filepath => {
  const result = await ffprobe(`-v error -select_streams v:0 -show_entries stream=width,height -of json "${filepath}"`)
  if (result?.status && result.stdout) {
    try {
      const stream = JSON.parse(result.stdout)?.streams?.[0]
      if (stream?.width && stream?.height) return { width: stream.width, height: stream.height }
    } catch { }
  }
  return { width: 1920, height: 1080 }
}

const normalizeDanmaku = (source, item) => {
  if (source === 'bilibili') {
    return {
      time: Number(item.progress || 0) / 1000,
      text: item.content,
      mode: Number(item.mode || 1)
    }
  }

  return {
    time: Number(item.offset_time || item.time || 0) / 1000,
    text: item.text,
    mode: 1
  }
}

const generateAss = (source, danmakuList, width, height, options = {}) => {
  const font = FONT_SIZE[options.danmakuFontSize] || FONT_SIZE.medium
  const scrollTime = Number(options.scrollTime || 8)
  const opacity = Math.round((100 - Math.max(0, Math.min(100, Number(options.danmakuOpacity ?? 70)))) * 2.55)
  const alpha = opacity.toString(16).padStart(2, '0').toUpperCase()
  const area = Math.max(0.25, Math.min(1, Number(options.danmakuArea || 0.5)))
  const topMargin = 24
  const trackCount = Math.max(1, Math.floor((height * area - topMargin) / font.track))
  const tracks = Array.from({ length: trackCount }, () => 0)

  const header = `[Script Info]
Title: kkk Danmaku
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${options.fontName || 'Microsoft YaHei'},${font.size},&H${alpha}FFFFFF,&H${alpha}FFFFFF,&H80000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`

  const lines = []
  const items = danmakuList
    .map(item => normalizeDanmaku(source, item))
    .filter(item => item.text && item.time >= 0)
    .sort((a, b) => a.time - b.time)

  for (const item of items) {
    let trackIndex = tracks.findIndex(end => end <= item.time)
    if (trackIndex < 0) trackIndex = Math.floor(item.time * 10) % trackCount
    tracks[trackIndex] = item.time + 1.2

    const y = topMargin + trackIndex * font.track
    const start = secondsToAssTime(item.time)
    const end = secondsToAssTime(item.time + scrollTime)
    const text = escapeAss(item.text)

    if (source === 'bilibili' && item.mode === 5) {
      lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an8\\pos(${Math.floor(width / 2)},${y + font.size})}${text}`)
    } else if (source === 'bilibili' && item.mode === 4) {
      lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an2\\pos(${Math.floor(width / 2)},${height - y})}${text}`)
    } else {
      const textWidth = Math.max(font.size * 4, text.length * font.size)
      lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,{\\move(${width},${y},-${textWidth},${y})}${text}`)
    }
  }

  return `${header}\n${lines.join('\n')}\n`
}

export const burnDanmaku = async (source, videoPath, danmakuList, outputPath, options = {}) => {
  if (!danmakuList?.length) return false
  const resolution = await getVideoResolution(videoPath)
  const assPath = videoPath.replace(/\.[^.]+$/, `_${source}_danmaku.ass`)
  await fs.promises.writeFile(assPath, generateAss(source, danmakuList, resolution.width, resolution.height, options), 'utf8')

  try {
    const assFilterPath = normalizeFilterPath(assPath)
    const result = await ffmpeg(`-y -i "${videoPath}" -vf "subtitles='${assFilterPath}'" -c:v libx264 -preset medium -crf 23 -c:a copy "${outputPath}"`)
    if (!result?.status) {
      logger.error(`[Danmaku] ${source} 弹幕烧录失败`, result)
      return false
    }
    return true
  } finally {
    fs.unlink(assPath, () => { })
  }
}
