import fs from 'node:fs'
import path from 'node:path'
import { Networks, baseHeaders } from '../../utils/Networks.js'
import Common from '../../utils/Common.js'
import Config from '../../utils/Config.js'
import { Render } from '../../utils/Render.js'
import { ffmpeg, loopVideoWithTransition } from '../../utils/FFmpeg.js'

const xmpHeaderBuffer = Buffer.from('http://ns.adobe.com/xap/1.0/\u0000', 'utf8')
const oppoExifHex = 'FFE100724578696600004D4D002A0000000800040100000400000001000005A001010004000000010000043C87690004000000010000003E011200030000000100000000000000000002928600020000000E0000005C920800040000000100000000000000006F706C75735F3833383836303800'
const xiaomiExifHex = 'FFE1007E4578696600004D4D002A0000000800040100000400000001000005A001010004000000010000043C01120003000000010000000087690004000000010000003E000000000003889700010000000101000000920800040000000100000000928600020000000E00000068000000006F706C75735F3833383836303800'
const huaweiHonorLiveIdFallback = 1915884

const getLivePhotoMode = () => {
  const mode = Config.app.livePhotoMode
  if (['video_and_livephoto', 'video_only', 'livephoto_only'].includes(mode)) return mode
  return 'video_and_livephoto'
}

const getMotionPhotoSystem = () => {
  const system = Config.app.livePhotoSystem
  if (['google', 'xiaomi', 'oppo', 'huawei_honor'].includes(system)) return system
  return 'google'
}

const getTimestampName = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const livePhotoTipText = '实况照片已生成，保存原图到相册后可识别为实况图'

export const buildLivePhotoTipMessage = async () => {
  try {
    return await Render('other/live-photo-tip', {
      title: '保存原图',
      description: '点击「查看原图」后保存到相册即可识别为实况照片'
    })
  } catch (error) {
    logger.warn(`[实况图] 提示图渲染失败，使用文本回退: ${error?.message || error}`)
    return livePhotoTipText
  }
}

const downloadToFile = async (url, filepath, headers) => {
  await Common.mkdir(path.dirname(filepath))
  return await new Networks({
    url,
    filepath,
    headers,
    timeout: 30000
  }).downloadStream(() => {})
}

const loopVideo = async (inputPath, outputPath, options = {}) => {
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

const isJpegBuffer = (buffer) => buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8

const getJpegDimensions = (jpegBuffer) => {
  let offset = 2
  while (offset + 9 < jpegBuffer.length) {
    if (jpegBuffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = jpegBuffer[offset + 1]
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

const buildExifSegment = (hex, width, height) => {
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

const getSystemExifHex = (system) => {
  if (system === 'oppo') return oppoExifHex
  if (system === 'xiaomi') return xiaomiExifHex
  return null
}

const hasExifApp1 = (jpegBuffer) => jpegBuffer.includes(Buffer.from('Exif\u0000\u0000', 'binary'))

const buildMotionPhotoXmp = (videoLength, presentationTimestampUs, system, hdrGainMapLength = 0) => {
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

const injectXmpToJpeg = (jpegBuffer, xmpPacket, system) => {
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

const readOrConvertToJpeg = async (imagePath) => {
  const sourceBuffer = fs.readFileSync(imagePath)
  if (isJpegBuffer(sourceBuffer)) return sourceBuffer

  const tempJpegPath = path.join(Common.tempDri.images, `motion_${getTimestampName()}.jpg`)
  const result = await ffmpeg(`-y -i "${imagePath}" -frames:v 1 -q:v 2 "${tempJpegPath}"`)
  if (!result?.status) throw new Error(`图片转换 JPEG 失败: ${imagePath}`)

  try {
    return fs.readFileSync(tempJpegPath)
  } finally {
    fs.rmSync(tempJpegPath, { force: true })
  }
}

const detectHdrGainMap = (imageBuffer) => {
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
  } catch (error) {
    logger.debug?.('HDR GainMap 检测失败', error)
    return 0
  }
}

const buildGoogleMotionPhoto = async ({ imagePath, videoPath, outputPath, presentationTimestampUs = 0, hdrGainMapLength }) => {
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
 * 生成实况图相关消息元素。
 * @param {Object} options
 * @param {string} options.platform 日志与临时文件前缀
 * @param {string} options.staticUrl 静态图地址
 * @param {string} options.liveVideoUrl 实况图视频地址
 * @param {number} options.index 当前图片序号
 * @param {import('axios').AxiosRequestConfig['headers']} [options.headers]
 * @param {string} [options.bgmPath] 本地 BGM 文件路径
 * @param {'independent'|'continuous'} [options.mergeMode] BGM 合并模式
 * @param {{bgmPath: string, bgmDuration: number, usedDuration: number}} [options.context] 连续模式上下文
 * @param {number} [options.loopCount] 视频循环次数
 * @returns {Promise<{messages: any[], tempFiles: any[], generatedLivePhoto: boolean, context?: {bgmPath: string, bgmDuration: number, usedDuration: number}}>}
 */
export const buildLivePhotoMessages = async (options) => {
  const messages = []
  const tempFiles = []
  const mode = getLivePhotoMode()
  const shouldGenerateVideo = mode === 'video_and_livephoto' || mode === 'video_only'
  const shouldGenerateLivePhoto = mode === 'video_and_livephoto' || mode === 'livephoto_only'

  if (!options?.staticUrl || !options?.liveVideoUrl || (!shouldGenerateVideo && !shouldGenerateLivePhoto)) {
    return { messages, tempFiles, generatedLivePhoto: false }
  }

  const platform = options.platform || 'livephoto'
  const headers = options.headers || baseHeaders
  const name = getTimestampName()
  const index = options.index || 0
  const staticPath = path.join(Common.tempDri.images, `${platform}_static_${name}_${index}.jpg`)
  const liveVideoPath = path.join(Common.tempDri.video, `${platform}_live_src_${name}_${index}.mp4`)

  try {
    const staticFile = await downloadToFile(options.staticUrl, staticPath, headers)
    const liveVideo = await downloadToFile(options.liveVideoUrl, liveVideoPath, headers)
    tempFiles.push(staticFile, liveVideo)

    if (shouldGenerateVideo) {
      const loopPath = path.join(Common.tempDri.video, `${platform}_live_loop_${name}_${index}.mp4`)
      const loopResult = await loopVideo(liveVideo.filepath, loopPath, {
        staticImagePath: staticFile.filepath,
        bgmPath: options.bgmPath,
        mergeMode: options.mergeMode,
        context: options.context,
        loopCount: options.loopCount
      })
      if (loopResult.success) {
        tempFiles.push({ filepath: loopPath, totalBytes: 0 })
        const videoPath = Config.upload.videoSendMode === 'base64'
          ? `base64://${fs.readFileSync(loopPath).toString('base64')}`
          : `file://${loopPath}`
        messages.push(segment.video(videoPath))
        options.context = loopResult.context || options.context
      }
    }

    if (shouldGenerateLivePhoto) {
      const motionPath = path.join(Common.tempDri.images, `MVIMG_${name}_${index}.jpg`)
      if (await buildGoogleMotionPhoto({ imagePath: staticFile.filepath, videoPath: liveVideo.filepath, outputPath: motionPath })) {
        tempFiles.push({ filepath: motionPath, totalBytes: 0 })
        const imagePath = Config.upload.imageSendMode === 'base64'
          ? `base64://${fs.readFileSync(motionPath).toString('base64')}`
          : `file://${motionPath}`
        messages.push(segment.image(imagePath))
      }
    }

    return { messages, tempFiles, generatedLivePhoto: messages.some(item => item?.type === 'image'), context: options.context }
  } catch (error) {
    logger.warn(`[${platform}] 实况图处理失败，将回退普通图片`, error)
    return { messages: [], tempFiles, generatedLivePhoto: false }
  }
}
