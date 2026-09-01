import fs from 'node:fs'
import path from 'node:path'
import type { AxiosRequestConfig } from 'axios'
import type { FileInfo } from '@/types/platform'
import type { LoopVideoContext } from '@/module/utils/FFmpeg'
import type { ImageMessage } from '@/module/utils/Watermark'
import { Networks, baseHeaders } from '@/module/utils/Network/index'
import Common from '@/module/utils/Common'
import Config from '@/module/utils/Config'
import { getDownloadBudgetLimit } from '@/module/utils/Network/DownloadBudget'
import { Render } from '@/module/utils/Render'
import { ffmpeg, loopVideoWithTransition } from '@/module/utils/FFmpeg'
import { getErrorMessage } from '@/module/utils/error-message'
import { isRecord } from '@/module/utils/record'
import type { BuildLivePhotoBatchResult, BuildLivePhotoResult, LivePhotoBatchItem, LivePhotoBatchItemResult } from './types.js'

export type LivePhotoMode = 'video_and_livephoto' | 'video_only' | 'livephoto_only'

export type MotionPhotoSystem = 'google' | 'xiaomi' | 'oppo' | 'huawei_honor'

export type LivePhotoMergeMode = 'independent' | 'continuous'

/** 整批图共用的实况图参数 */
export interface BuildLivePhotoBatchOptions {
  /** 日志与临时文件前缀 */
  platform?: string
  headers?: AxiosRequestConfig['headers']
  /** 本地 BGM 文件路径 */
  bgmPath?: string
  /** BGM 合并模式 */
  mergeMode?: LivePhotoMergeMode
  /** 连续模式上下文。批量入口把它当成整批的起点，之后按序在批内自己串下去 */
  context?: LoopVideoContext
  /**
   * 滑动窗口大小：同时处于「已开始下载但还没被 ffmpeg 消费」状态的图片数上限。
   * 缺省取所属平台桶的下载额度。它决定磁盘峰值 —— 临时文件要到整批发完才删，
   * 全量预下载会让一个 30 图图集峰值涨到上百 MB。
   */
  windowSize?: number
}

/** 实况图消息构建选项（单张入口） */
export interface BuildLivePhotoOptions extends LivePhotoBatchItem, BuildLivePhotoBatchOptions {}

interface LoopVideoLocalOptions {
  loopCount?: number
  staticImagePath?: string
  transitionEnabled?: boolean
  bgmPath?: string
  mergeMode?: LivePhotoMergeMode
  context?: LoopVideoContext
}

interface MotionPhotoBuildOptions {
  imagePath: string
  videoPath: string
  outputPath: string
  presentationTimestampUs?: number
  hdrGainMapLength?: number
}

const xmpHeaderBuffer = Buffer.from('http://ns.adobe.com/xap/1.0/\u0000', 'utf8')
const oppoExifHex = 'FFE100724578696600004D4D002A0000000800040100000400000001000005A001010004000000010000043C87690004000000010000003E011200030000000100000000000000000002928600020000000E0000005C920800040000000100000000000000006F706C75735F3833383836303800'
const xiaomiExifHex = 'FFE1007E4578696600004D4D002A0000000800040100000400000001000005A001010004000000010000043C01120003000000010000000087690004000000010000003E000000000003889700010000000101000000920800040000000100000000928600020000000E00000068000000006F706C75735F3833383836303800'
const huaweiHonorLiveIdFallback = 1915884

const getLivePhotoMode = (): LivePhotoMode => {
  const mode = Config.app.livePhotoMode
  if (mode === 'video_and_livephoto' || mode === 'video_only' || mode === 'livephoto_only') return mode
  return 'video_and_livephoto'
}

const getMotionPhotoSystem = (): MotionPhotoSystem => {
  const system = Config.app.livePhotoSystem
  if (system === 'google' || system === 'xiaomi' || system === 'oppo' || system === 'huawei_honor') return system
  return 'google'
}

const getTimestampName = (): string => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
/**
 * 渲染失败时的纯文本回退。措辞照抄提示图上写死的那两句（标题 + 说明），
 * 让收到图和收到文本的人被告知的是同一件事 —— 图上说「点击查看原图」，
 * 回退文本却说「保存原图到相册」，用户会按错的那条做。
 */
const livePhotoTipText = '保存原图：点击「查看原图」后保存到相册即可识别为实况照片'

export const buildLivePhotoTipMessage = async (): Promise<ImageMessage[] | false | string> => {
  try {
    // 不传 payload：这张图是纯静态的，文案写死在组件 JSX 里（见 components/types.ts）。
    return await Render('other/live-photo-tip')
  } catch (error: unknown) {
    logger.warn(`[实况图] 提示图渲染失败，使用文本回退: ${getErrorMessage(error)}`)
    return livePhotoTipText
  }
}

const downloadToFile = async (
  url: string,
  filepath: string,
  headers: AxiosRequestConfig['headers']
): Promise<FileInfo> => {
  await Common.mkdir(path.dirname(filepath))
  return await new Networks({
    url,
    filepath,
    headers,
    timeout: 30000
  }).downloadStream(() => {})
}

const loopVideo = async (
  inputPath: string,
  outputPath: string,
  options: LoopVideoLocalOptions = {}
): Promise<{ success: boolean, context?: LoopVideoContext }> => {
  await Common.mkdir(path.dirname(outputPath))
  const result = await loopVideoWithTransition({
    inputPath,
    outputPath,
    loopCount: options.loopCount || 3,
    staticImagePath: options.staticImagePath || inputPath,
    transitionEnabled: options.transitionEnabled !== false && Boolean(options.staticImagePath),
    bgmPath: options.bgmPath,
    mergeMode: options.mergeMode,
    context: options.context
  })
  if (result?.success) return result
  logger.warn('[实况图] 循环视频生成失败', result)
  return { success: false }
}

const isJpegBuffer = (buffer: Buffer): boolean => buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8

const getJpegDimensions = (jpegBuffer: Buffer): { width: number, height: number } | null => {
  let offset = 2
  while (offset + 9 < jpegBuffer.length) {
    if (jpegBuffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = jpegBuffer[offset + 1]
    if (marker === undefined) return null
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }

    if (offset + 3 >= jpegBuffer.length) return null
    const segmentLength = jpegBuffer.readUInt16BE(offset + 2)
    if (segmentLength < 2 || offset + 2 + segmentLength > jpegBuffer.length) return null

    const isSofMarker =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)

    if (isSofMarker && segmentLength >= 7) {
      const height = jpegBuffer.readUInt16BE(offset + 5)
      const width = jpegBuffer.readUInt16BE(offset + 7)
      return width > 0 && height > 0 ? { width, height } : null
    }

    offset += 2 + segmentLength
  }
  return null
}

const buildExifSegment = (hex: string, width: number, height: number): Buffer => {
  const exifBuffer = Buffer.from(hex, 'hex')
  exifBuffer[28] = (width >> 24) & 0xff
  exifBuffer[29] = (width >> 16) & 0xff
  exifBuffer[30] = (width >> 8) & 0xff
  exifBuffer[31] = width & 0xff
  exifBuffer[40] = (height >> 24) & 0xff
  exifBuffer[41] = (height >> 16) & 0xff
  exifBuffer[42] = (height >> 8) & 0xff
  exifBuffer[43] = height & 0xff
  return exifBuffer
}

const getSystemExifHex = (system: MotionPhotoSystem): string | null => {
  if (system === 'oppo') return oppoExifHex
  if (system === 'xiaomi') return xiaomiExifHex
  return null
}

const hasExifApp1 = (jpegBuffer: Buffer): boolean => jpegBuffer.includes(Buffer.from('Exif\u0000\u0000', 'binary'))

const buildMotionPhotoXmp = (
  videoLength: number,
  presentationTimestampUs: number,
  system: MotionPhotoSystem,
  hdrGainMapLength = 0
): string => {
  if (system === 'oppo') {
    const containerItems = [
      '<rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="image/jpeg" Item:Semantic="Primary" Item:Length="0" Item:Padding="0" /></rdf:li>'
    ]
    if (hdrGainMapLength > 0) {
      containerItems.push(`<rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="image/jpeg" Item:Semantic="GainMap" Item:Length="${hdrGainMapLength}" Item:Padding="0" /></rdf:li>`)
    }
    containerItems.push(`<rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${videoLength}" /></rdf:li>`)

    return '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003">' +
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" xmlns:OpCamera="http://ns.oplus.com/photos/1.0/camera/" xmlns:Container="http://ns.google.com/photos/1.0/container/" xmlns:Item="http://ns.google.com/photos/1.0/container/item/" ' +
      'hdrgm:Version="1.0" ' +
      `GCamera:MotionPhoto="1" GCamera:MotionPhotoVersion="1" GCamera:MotionPhotoPresentationTimestampUs="${presentationTimestampUs}" OpCamera:MotionPhotoPrimaryPresentationTimestampUs="${presentationTimestampUs}" OpCamera:MotionPhotoOwner="oplus" OpCamera:OLivePhotoVersion="2" OpCamera:VideoLength="${videoLength}">` +
      '<Container:Directory><rdf:Seq>' +
      containerItems.join('') +
      '</rdf:Seq></Container:Directory></rdf:Description></rdf:RDF></x:xmpmeta>'
  }

  if (system === 'xiaomi') {
    return '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003">' +
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" xmlns:MiCamera="http://ns.xiaomi.com/photos/1.0/camera/" xmlns:Container="http://ns.google.com/photos/1.0/container/" xmlns:Item="http://ns.google.com/photos/1.0/container/item/" ' +
      `GCamera:MotionPhoto="1" GCamera:MotionPhotoVersion="1" GCamera:MotionPhotoPresentationTimestampUs="${presentationTimestampUs}" GCamera:MicroVideo="1" GCamera:MicroVideoVersion="1" GCamera:MicroVideoOffset="${videoLength}" GCamera:MicroVideoPresentationTimestampUs="${presentationTimestampUs}" MiCamera:XMPMeta="&lt;?xml version=&apos;1.0&apos; encoding=&apos;UTF-8&apos; standalone=&apos;yes&apos; ?&gt;">` +
      '<Container:Directory><rdf:Seq>' +
      '<rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="image/jpeg" Item:Semantic="Primary" Item:Length="0" Item:Padding="0" /></rdf:li>' +
      `<rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${videoLength}" Item:Padding="0" /></rdf:li>` +
      '</rdf:Seq></Container:Directory></rdf:Description></rdf:RDF></x:xmpmeta>'
  }

  return '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:GCamera="http://ns.google.com/photos/1.0/camera/" xmlns:Container="http://ns.google.com/photos/1.0/container/" xmlns:Item="http://ns.google.com/photos/1.0/container/item/" ' +
    `GCamera:MotionPhoto="1" GCamera:MotionPhotoVersion="1" GCamera:MotionPhotoPresentationTimestampUs="${presentationTimestampUs}">` +
    '<Container:Directory><rdf:Seq>' +
    '<rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="image/jpeg" Item:Semantic="Primary" Item:Length="0" Item:Padding="0" /></rdf:li>' +
    `<rdf:li rdf:parseType="Resource"><Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${videoLength}" Item:Padding="0" /></rdf:li>` +
    '</rdf:Seq></Container:Directory></rdf:Description></rdf:RDF></x:xmpmeta>'
}

const injectXmpToJpeg = (jpegBuffer: Buffer, xmpPacket: string, system: MotionPhotoSystem): Buffer => {
  if (!isJpegBuffer(jpegBuffer)) throw new Error('输入图片不是 JPEG 格式')

  const xmpPayload = Buffer.concat([xmpHeaderBuffer, Buffer.from(xmpPacket, 'utf8')])
  const app1Length = xmpPayload.length + 2
  if (app1Length > 65535) throw new Error('XMP 数据过大，无法写入 JPEG APP1')

  const app1Segment = Buffer.alloc(4)
  app1Segment[0] = 0xff
  app1Segment[1] = 0xe1
  app1Segment.writeUInt16BE(app1Length, 2)

  const dimensions = getJpegDimensions(jpegBuffer)
  const exifHex = getSystemExifHex(system)
  const needExif = !hasExifApp1(jpegBuffer) && dimensions && exifHex
  const exifSegment = needExif ? buildExifSegment(exifHex, dimensions.width, dimensions.height) : null

  return Buffer.concat([jpegBuffer.subarray(0, 2), ...(exifSegment ? [exifSegment] : []), app1Segment, xmpPayload, jpegBuffer.subarray(2)])
}

const readOrConvertToJpeg = async (imagePath: string): Promise<Buffer> => {
  const sourceBuffer = fs.readFileSync(imagePath)
  if (isJpegBuffer(sourceBuffer)) return sourceBuffer

  const tempJpegPath = path.join(Common.tempDri.images, `motion_${getTimestampName()}.jpg`)
  const result = await ffmpeg(['-y', '-i', imagePath, '-frames:v', '1', '-q:v', '2', tempJpegPath])
  if (!result?.status) throw new Error(`图片转换 JPEG 失败: ${imagePath}`)

  try {
    return fs.readFileSync(tempJpegPath)
  } finally {
    fs.rmSync(tempJpegPath, { force: true })
  }
}

const detectHdrGainMap = (imageBuffer: Buffer): number => {
  try {
    const xmpStart = imageBuffer.indexOf('http://ns.adobe.com/xap/1.0/')
    if (xmpStart === -1) return 0

    const marker = 'Item:Semantic="GainMap"'
    const markerIndex = imageBuffer.indexOf(marker, xmpStart)
    if (markerIndex === -1) return 0

    const xmpSection = imageBuffer.subarray(xmpStart, xmpStart + 4096).toString('utf8')
    const gainMapSection = xmpSection.slice(xmpSection.indexOf(marker))
    const lengthMatch = gainMapSection.match(/Item:Length="(\d+)"/)
    if (lengthMatch?.[1]) return Number.parseInt(lengthMatch[1], 10)

    return 463255
  } catch (error: unknown) {
    logger.debug?.('HDR GainMap 检测失败', error)
    return 0
  }
}

const buildGoogleMotionPhoto = async ({
  imagePath,
  videoPath,
  outputPath,
  presentationTimestampUs = 0,
  hdrGainMapLength
}: MotionPhotoBuildOptions): Promise<boolean> => {
  const system = getMotionPhotoSystem()
  const imageBuffer = await readOrConvertToJpeg(imagePath)
  const videoBuffer = fs.readFileSync(videoPath)
  const resolvedTimestampUs = presentationTimestampUs < 0 ? 0 : presentationTimestampUs
  const resolvedHdrGainMapLength = system === 'oppo' ? (hdrGainMapLength ?? detectHdrGainMap(imageBuffer)) : 0
  const outputBuffer = system === 'huawei_honor'
    ? Buffer.concat([imageBuffer, Buffer.from(`v2_f35              409:1000            LIVE_${resolvedTimestampUs > 0 ? Math.floor(resolvedTimestampUs) : huaweiHonorLiveIdFallback}`, 'utf8')])
    : Buffer.concat([injectXmpToJpeg(imageBuffer, buildMotionPhotoXmp(videoBuffer.length, resolvedTimestampUs, system, resolvedHdrGainMapLength), system), videoBuffer])

  await Common.mkdir(path.dirname(outputPath))
  fs.writeFileSync(outputPath, outputBuffer)
  return true
}

/**
 * 一张图的下载产物。
 *
 * 下载（网络 I/O，可以并发）和转码（ffmpeg，必须串行）在这里被切成两半，
 * 批量入口才能让二者重叠：下载在信号量额度内滑动窗口推进，ffmpeg 按序单线程消费。
 */
type LivePhotoDownload =
  | {
    /** 这张图不做实况图（缺地址，或生成模式两项都关了） */
    kind: 'skipped'
  }
  | {
    kind: 'failed'
    tempFiles: FileInfo[]
    error: unknown
  }
  | {
    kind: 'ready'
    tempFiles: FileInfo[]
    staticFile: FileInfo
    liveVideo: FileInfo
    loopPath: string
    motionPath: string
  }

const getGenerationPlan = (): { video: boolean, livePhoto: boolean } => {
  const mode = getLivePhotoMode()
  return {
    video: mode === 'video_and_livephoto' || mode === 'video_only',
    livePhoto: mode === 'video_and_livephoto' || mode === 'livephoto_only'
  }
}

/**
 * 下载一张图的静态图和实况视频。**不抛异常**：失败也返回结果对象。
 *
 * 批量入口会先把若干张的下载并发跑起来、之后才逐个 await，任何一个 reject 都会变成
 * unhandled rejection，所以失败必须走返回值而不是异常。
 */
const downloadLivePhotoSources = async (
  item: LivePhotoBatchItem,
  shared: BuildLivePhotoBatchOptions
): Promise<LivePhotoDownload> => {
  const plan = getGenerationPlan()
  if (!item.staticUrl || !item.liveVideoUrl || (!plan.video && !plan.livePhoto)) {
    return { kind: 'skipped' }
  }

  const platform = shared.platform || 'livephoto'
  const headers = shared.headers || baseHeaders
  const name = getTimestampName()
  const index = item.index || 0
  const staticPath = path.join(Common.tempDri.images, `${platform}_static_${name}_${index}.jpg`)
  const liveVideoPath = path.join(Common.tempDri.video, `${platform}_live_src_${name}_${index}.mp4`)
  const tempFiles: FileInfo[] = []

  // 静态图和实况视频之间没有任何依赖，原先两个连续 await 是纯白等。
  //
  // 用 allSettled 而不是 all：半边失败时另一边可能已经落盘，那个文件必须被收进
  // tempFiles，否则临时文件泄漏 —— 改造前就是这样，旧代码在两个下载都成功后才
  // `push(staticFile, liveVideo)`，视频下载失败时静态图就永远留在磁盘上了。
  const [staticResult, videoResult] = await Promise.allSettled([
    downloadToFile(item.staticUrl, staticPath, headers),
    downloadToFile(item.liveVideoUrl, liveVideoPath, headers)
  ])
  if (staticResult.status === 'fulfilled') tempFiles.push(staticResult.value)
  if (videoResult.status === 'fulfilled') tempFiles.push(videoResult.value)

  // 两个分支分开写而不是三元：TS 只在各自的 if 里才把 PromiseSettledResult
  // 收窄成 rejected，合成一条三元的话 else 侧读不到 .reason。
  if (staticResult.status === 'rejected') {
    return { kind: 'failed', tempFiles, error: staticResult.reason }
  }
  if (videoResult.status === 'rejected') {
    return { kind: 'failed', tempFiles, error: videoResult.reason }
  }

  return {
    kind: 'ready',
    tempFiles,
    staticFile: staticResult.value,
    liveVideo: videoResult.value,
    loopPath: path.join(Common.tempDri.video, `${platform}_live_loop_${name}_${index}.mp4`),
    motionPath: path.join(Common.tempDri.images, `MVIMG_${name}_${index}.jpg`)
  }
}

/**
 * 把一张图的下载产物转码成消息段。**必须串行调用**，两条独立理由：
 *
 * 1. `mergeMode === 'continuous'` 时 `context` 是每轮输出喂下一轮输入的串行数据依赖 ——
 *    第 N 张图的视频要知道 BGM 在第 N-1 张结束时播到哪。并发跑就断了这条链。
 * 2. ffmpeg 是 CPU 密集型，并发只会互相抢资源。
 *
 * 同样**不抛异常**：失败时返回空 messages。`tempFiles` 是函数级累加器而不是 return
 * 时才拼的，所以 catch 里也能把已经产出的临时文件带回去。
 */
const composeLivePhoto = async (
  download: Extract<LivePhotoDownload, { kind: 'ready' }>,
  item: LivePhotoBatchItem,
  shared: BuildLivePhotoBatchOptions,
  context: LoopVideoContext | undefined
): Promise<BuildLivePhotoResult> => {
  const platform = shared.platform || 'livephoto'
  const plan = getGenerationPlan()
  const messages: unknown[] = []
  const tempFiles: FileInfo[] = []
  let nextContext = context

  try {
    if (plan.video) {
      const loopResult = await loopVideo(download.liveVideo.filepath, download.loopPath, {
        staticImagePath: download.staticFile.filepath,
        bgmPath: shared.bgmPath,
        mergeMode: shared.mergeMode,
        context: nextContext,
        loopCount: item.loopCount
      })
      if (loopResult.success) {
        tempFiles.push({ filepath: download.loopPath, totalBytes: 0 })
        const videoPath = Config.upload.videoSendMode === 'base64'
          ? `base64://${fs.readFileSync(download.loopPath).toString('base64')}`
          : `file://${download.loopPath}`
        messages.push(segment.video(videoPath))
        nextContext = loopResult.context || nextContext
      }
    }

    if (plan.livePhoto) {
      const built = await buildGoogleMotionPhoto({
        imagePath: download.staticFile.filepath,
        videoPath: download.liveVideo.filepath,
        outputPath: download.motionPath
      })
      if (built) {
        tempFiles.push({ filepath: download.motionPath, totalBytes: 0 })
        const imagePath = Config.upload.imageSendMode === 'base64'
          ? `base64://${fs.readFileSync(download.motionPath).toString('base64')}`
          : `file://${download.motionPath}`
        messages.push(segment.image(imagePath))
      }
    }

    return {
      messages,
      tempFiles,
      generatedLivePhoto: messages.some(message => isRecord(message) && message.type === 'image'),
      context: nextContext
    }
  } catch (error: unknown) {
    logger.warn(`[${platform}] 实况图处理失败，将回退普通图片`, error)
    return { messages: [], tempFiles, generatedLivePhoto: false }
  }
}

/**
 * 契约不变：失败时返回 `messages: []`，调用方看到空数组就回退成普通图片；
 * `tempFiles` 在失败路径下也照样带回来。
 */
export const buildLivePhotoMessages = async (
  options: BuildLivePhotoOptions
): Promise<BuildLivePhotoResult> => {
  const download = await downloadLivePhotoSources(options, options)
  if (download.kind === 'skipped') {
    return { messages: [], tempFiles: [], generatedLivePhoto: false }
  }
  if (download.kind === 'failed') {
    logger.warn(`[${options.platform || 'livephoto'}] 实况图处理失败，将回退普通图片`, download.error)
    return { messages: [], tempFiles: download.tempFiles, generatedLivePhoto: false }
  }

  const composed = await composeLivePhoto(download, options, options, options.context)
  return {
    messages: composed.messages,
    tempFiles: [...download.tempFiles, ...composed.tempFiles],
    generatedLivePhoto: composed.generatedLivePhoto,
    context: composed.context
  }
}

/**
 * 批量生成实况图消息：下载滑动窗口并发推进，ffmpeg 严格按序单线程消费。
 *
 * 为什么不是「全量下完再转码」：临时文件要到整批发完才删，一个 30 图图集每对
 * static + video 约 1-3MB，全量落盘峰值约 100MB。窗口让「已下载但还没被消费」的
 * 数量恒定，磁盘峰值因此和图集大小无关。
 *
 * 为什么不是「一张一张下完就转」（改造前的样子）：那样下载和转码互相白等，
 * 而这两件事一个是网络 I/O、一个是 CPU，本该重叠。
 *
 * `items` 里不做实况图的位置传 `{}` 即可 —— 结果数组和输入**逐位对齐**，
 * 调用方按同一个下标取回退分支，输出顺序天然等于原图顺序。
 */
export const buildLivePhotoMessagesBatch = async (
  items: readonly LivePhotoBatchItem[],
  shared: BuildLivePhotoBatchOptions = {}
): Promise<BuildLivePhotoBatchResult> => {
  const results: LivePhotoBatchItemResult[] = []
  const tempFiles: FileInfo[] = []
  let generatedLivePhoto = false
  let context = shared.context
  if (items.length === 0) return { results, tempFiles, generatedLivePhoto, context }

  const requestedWindow = Math.trunc(Number(shared.windowSize))
  const windowSize = Number.isFinite(requestedWindow) && requestedWindow > 0
    ? requestedWindow
    : Math.max(1, getDownloadBudgetLimit())
  const platform = shared.platform || 'livephoto'
  const pending = new Map<number, Promise<LivePhotoDownload>>()
  let nextToStart = 0

  const itemAt = (index: number): LivePhotoBatchItem => {
    const item = items[index] ?? {}
    // index 只进临时文件名；调用方没显式给序号时用数组下标，保证同一批里不重名。
    return item.index === undefined ? { ...item, index } : item
  }

  const ensureStarted = (index: number): Promise<LivePhotoDownload> => {
    const existing = pending.get(index)
    if (existing !== undefined) return existing
    const task = downloadLivePhotoSources(itemAt(index), shared)
    pending.set(index, task)
    if (nextToStart <= index) nextToStart = index + 1
    return task
  }

  // pending 里装的正是「已开始下载、但还没被 ffmpeg 消费」的那些图，
  // 所以 `pending.size <= windowSize` 这条不变式就等价于磁盘峰值受窗口约束。
  const fillWindow = (): void => {
    while (nextToStart < items.length && pending.size < windowSize) ensureStarted(nextToStart)
  }

  fillWindow()

  for (let index = 0; index < items.length; index += 1) {
    const download = await ensureStarted(index)
    pending.delete(index)
    // 先补窗口再交给 ffmpeg：转码是串行的 CPU 活，下载要在它跑的时候继续推进，
    // 否则窗口就退化成「下一张、转一张」的白等。
    fillWindow()

    if (download.kind === 'skipped') {
      results[index] = { messages: [], generatedLivePhoto: false }
      continue
    }

    tempFiles.push(...download.tempFiles)

    if (download.kind === 'failed') {
      // 单张失败只影响这一张：调用方看到空 messages 就把它回退成普通图片。
      logger.warn(`[${platform}] 实况图处理失败，将回退普通图片`, download.error)
      results[index] = { messages: [], generatedLivePhoto: false }
      continue
    }

    const composed = await composeLivePhoto(download, itemAt(index), shared, context)
    tempFiles.push(...composed.tempFiles)
    // 连续 BGM 模式靠这一行串成一条链，所以上面那个 await 不能改成并发。
    context = composed.context ?? context
    generatedLivePhoto = generatedLivePhoto || composed.generatedLivePhoto
    // 按下标回填、不是按完成顺序 push —— 转发消息里图片的顺序就是这个数组的顺序。
    results[index] = { messages: composed.messages, generatedLivePhoto: composed.generatedLivePhoto }
  }

  return { results, tempFiles, generatedLivePhoto, context }
}
