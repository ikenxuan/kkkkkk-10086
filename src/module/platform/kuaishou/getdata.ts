import { isRecord } from '@/module/utils/record'
import { getKuaishouData } from './api.js'

/** 快手数据请求类型 */
export type KuaishouDataType = 'one_work' | '单个作品信息' | '作品评论信息'

/** 单个作品聚合结果 */
export interface KuaishouWorkPayload {
  VideoData: unknown
  CommentData: unknown
  EmojiData: unknown
}

/**
 * amagi 内部方法名 —— 全部取自 `@ikenxuan/amagi@6.5.0` 的
 * `KuaishouInternalMethods`（`dist/default/index.d.ts:26006`），wrapper 再通过
 * `KuaishouMethodToFetcher` 映射到英文 fetcher 方法名：
 *
 * | 中文内部方法名   | 英文 fetcher 方法名 |
 * | ---------------- | ------------------- |
 * | 单个视频作品数据 | fetchVideoWork      |
 * | 评论数据         | fetchWorkComments   |
 * | Emoji数据        | fetchEmojiList      |
 *
 * 刻意写常量而不是内联字面量：这三个名字是**跨包契约**，amagi 改名时应该在这里
 * 一眼看到，而不是散落在三个调用点里。
 *
 * amagi 另有 `用户主页数据` / `用户作品列表数据` / `直播间信息数据`
 * （`fetchUserProfile` / `fetchUserWorkList` / `fetchLiveRoomInfo`），
 * 本插件目前不用，属于新功能，另有安排。
 */
const KUAISHOU_METHODS = {
  videoWork: '单个视频作品数据',
  comments: '评论数据',
  emojiList: 'Emoji数据'
} as const

/**
 * 剥掉 amagi 的 `Result<T>` 外壳，还原成迁移前 `Networks.getData()` 的返回形状。
 *
 * 迁移前这里是直接 POST 快手 GraphQL、把响应体原样返回的，所以下游拿到的是
 * `{ data: { visionVideoDetail: ... } }`；amagi v6 在外面多包了一层
 * `{ success, code, message, data, error }`（`createSuccessResponse`，
 * `dist/default/index.cjs:1405`），于是同一个字段深了一层。
 *
 * **必须在这里剥掉，不能靠下游多写一层兜底**：
 * - `kuaishou.ts` 的 `Action` 恰好有两级兜底（`VideoData.data.data.x` 和
 *   `VideoData.data.x`），带壳也能读到 —— 但那是巧合。
 * - `comments.ts` 只有两级（`data.data.visionCommentList` 和 `data.visionCommentList`），
 *   带壳之后**两条都读不到**，评论会静默变成空数组。
 *
 * 所以正确的做法是让 `KuaishouWorkPayload` 的字段路径保持和迁移前逐字节一致，
 * 消费侧（`Action` / `comments()`）一行都不用改。
 *
 * @param value wrapper 的返回值，可能是 amagi 的 `Result`，也可能已经是裸响应
 * @returns 裸响应体
 */
const unwrapAmagiResult = (value: unknown): unknown => {
  // 判据取 `success` 是不是布尔：amagi 的成功与失败 Result 都带它，
  // 而快手 GraphQL 的响应体里没有这个键（它只有 data / result / errors）。
  if (isRecord(value) && typeof value.success === 'boolean') return value.data
  return value
}

/**
 * 取一次快手数据并剥壳，空响应照旧记一条 error 日志。
 *
 * 日志文案沿用迁移前 `GlobalGetData` 的那条 —— amagi 失败时返回的是
 * `{ success: false, ... }`，剥壳后 `data` 往往是 undefined，正好落进这里，
 * 而 `Action` 会因为读不到 `visionVideoDetail.status === 1` 回「不支持解析的视频」。
 * 也就是说取数失败的用户可见行为和迁移前一致。
 */
const fetchKuaishou = async (method: string, options?: Record<string, unknown>): Promise<unknown> => {
  const result = unwrapAmagiResult(await getKuaishouData(method, options))
  if (!result || result === '') {
    logger.error('获取响应数据失败！\n请求类型：' + method)
  }
  return result
}

export default class KuaishouData {
  type: KuaishouDataType

  constructor (type: KuaishouDataType) {
    this.type = type
  }

  async GetData (data: { photoId?: string }): Promise<KuaishouWorkPayload | unknown> {
    switch (this.type) {
      case 'one_work':
      case '单个作品信息': {
        // 三个请求之间没有任何数据依赖，迁移前是严格串行的（作品 → 评论 → 表情），
        // 白等两个往返。表情列表以后会另有一个提交给它加长 TTL 缓存，
        // 所以这里不自己造缓存，只并发。
        const [VideoData, CommentData, EmojiData] = await Promise.all([
          fetchKuaishou(KUAISHOU_METHODS.videoWork, { photoId: data.photoId }),
          fetchKuaishou(KUAISHOU_METHODS.comments, { photoId: data.photoId }),
          fetchKuaishou(KUAISHOU_METHODS.emojiList)
        ])

        return { VideoData, CommentData, EmojiData }
      }

      case '作品评论信息':
        return await fetchKuaishou(KUAISHOU_METHODS.comments, { photoId: data.photoId })

      default:
        break
    }
  }
}
