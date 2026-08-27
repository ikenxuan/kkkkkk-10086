import type { AxiosRequestConfig } from 'axios'
import { Base, Config, Render, Networks, downloadVideo } from '@/module/utils/index'
import comments, { type KuaishouEmoji } from './comments.js'

interface KuaishouPhoto {
  photoUrl?: string
  caption?: string
  viewCount?: number
  likeCount?: number
}

interface KuaishouVideoDetail {
  status?: number
  photo: KuaishouPhoto
}

/** KuaishouData.GetData 返回的聚合数据 */
export interface KuaishouActionPayload {
  VideoData?: {
    data?: {
      data?: { visionVideoDetail?: KuaishouVideoDetail }
      visionVideoDetail?: KuaishouVideoDetail
    }
  }
  CommentsData?: { data?: unknown }
  CommentData?: unknown
  EmojiData?: {
    data?: {
      data?: { visionBaseEmoticons?: { iconUrls?: Record<string, string> } }
      visionBaseEmoticons?: { iconUrls?: Record<string, string> }
    }
  }
}

/**
 * 探测视频体积用的请求头。
 *
 * 迁移前 `KuaishouData` 的构造函数会把 `Referer` / `Origin` / `Host` / `X-Requested-With`
 * 以及快手 ck **直接写进 `this.headers`** —— 而 `Base` 的 `this.headers` 就是
 * `Networks.ts` 里那个**模块级共享**的 `baseHeaders` 对象，赋值等于全局修改：
 * 一次快手解析之后，抖音 / B站 / 小红书的默认请求头里也带上了 `Host: www.kuaishou.com`
 * 和用户的快手 Cookie。
 *
 * 迁移到 amagi 后 cookie 与业务请求头都由 amagi 自己组装（`getKuaishouDefaultConfig`），
 * 那段污染代码随 `getdata.ts` 一起删掉了。但**下面这次 HEAD 探测不走 amagi**，
 * 它是本仓库自己用 `Networks` 发的；而它之前恰好是靠那份污染拿到 `Referer` 的。
 * 所以在这里显式补上，免得把污染删掉的同时静默丢掉防盗链头。
 *
 * 只补 `Referer` / `Origin`：`Host` 由 axios 按 URL 自己算（写死会指错 CDN 域名），
 * Cookie 对取 `content-length` 没有必要，也不该把 ck 发给视频 CDN。
 */
const kuaishouMediaHeaders = (base: AxiosRequestConfig['headers']): AxiosRequestConfig['headers'] => ({
  ...(base as Record<string, unknown>),
  Referer: 'https://www.kuaishou.com/',
  Origin: 'https://www.kuaishou.com'
})

export default class KuaiShou extends Base {
  constructor (e: ConstructorParameters<typeof Base>[0] = {}, _Iddata?: unknown) {
    super()
    this.e = e
  }

  async Action (data: KuaishouActionPayload): Promise<boolean> {
    const videoDetail = data.VideoData?.data?.data?.visionVideoDetail || data.VideoData?.data?.visionVideoDetail
    const commentsData = data.CommentsData?.data || data.CommentsData || data.CommentData
    const emojiList = data.EmojiData?.data?.data?.visionBaseEmoticons?.iconUrls || data.EmojiData?.data?.visionBaseEmoticons?.iconUrls || {}

    if (videoDetail?.status !== 1) {
      await this.e!.reply!('不支持解析的视频')
      return true
    }
    ;(Config.app.parseTip || Config.kuaishou.kuaishoutip) && await this.e!.reply!('检测到快手链接，开始解析')
    const video_url = videoDetail.photo.photoUrl
    const transformedData: KuaishouEmoji[] = Object.entries(emojiList).map(([name, path]) => {
      return { name, url: `https:${path}` }
    })
    const CommentsData = await comments(commentsData as Parameters<typeof comments>[0], transformedData)
    const videoheaders = await new Networks({ url: video_url as string, headers: kuaishouMediaHeaders(this.headers) }).getHeaders()
    const Size = videoheaders['content-length'] ? parseInt(videoheaders['content-length'], 10) : 0
    const videoSizeInMB = (Size / (1024 * 1024)).toFixed(2)
    const img = await Render(
      'kuaishou/comment',
      {
        Type: '视频',
        viewCount: videoDetail.photo.viewCount,
        CommentsData,
        // 契约要 number：模板里是 `CommentLength > 0` 这种数值比较，传字符串时 '0' > 0 为 false 但 '3' > 0 为 true，
        // 靠隐式转换蒙对不如直接给数字
        CommentLength: CommentsData?.length ?? 0,
        // photoUrl 是可选字段，契约里 share_url 必填 string；拿不到就给空串，别把 undefined 塞进模板
        share_url: video_url || '',
        VideoSize: videoSizeInMB,
        likeCount: videoDetail.photo.likeCount
      }
    )
    await this.e!.reply!(img)
    await downloadVideo(this.e as Parameters<typeof downloadVideo>[0], {
      video_url: video_url as string,
      title: {
        timestampTitle: `tmp_${Date.now()}.mp4`,
        originTitle: `${videoDetail.photo.caption || '快手作品'}.mp4`
      }
    })
    return true
  }
}
