import { isRecord } from '@/module/utils/record'
import Config from '@/module/utils/Config'
import { buildAmagiRequestConfig, kuaishouFetcher } from '@/module/utils/amagiClient'

export type KuaishouDataType = 'one_work' | '单个作品信息' | '作品评论信息'

export interface KuaishouWorkPayload {
  VideoData: unknown
  /**
   * 评论与表情两跳挪进 `KuaiShou.Action` 的评论支线后，payload 只需要带上作品 ID。
   *
   * 见 {@link fetchKuaishouWorkComments}。
   */
  photoId?: string
}

/**
 * 没配 `Config.cookies.kuaishou` 时用的游客 ck。
 *
 * **不能删**：amagi 6.5.0 的 `getKuaishouDefaultConfig` 只做 `Cookie: cookie?.trim() ?? ''`，
 * **没有**自己的游客兜底。而快手 GraphQL 在完全不带 Cookie 时会返回空响应、被 amagi
 * 归一成 `INVALID_COOKIE`，于是没配 ck 的用户会直接坏掉。
 * （`kpn=KUAISHOU_VISION` 是快手 web 端必需的产品标识。）
 */
const KUAISHOU_GUEST_COOKIE =
  'did=web_50424132d556424eb8fa8d27a612fda9; didv=1720860549000; kpf=PC_WEB; clientid=3; kpn=KUAISHOU_VISION'

/**
 * 用到的 amagi fetcher 方法名。
 *
 * 刻意写常量而不是内联字面量：这三个名字是**跨包契约**，amagi 改名时应该在这里
 * 一眼看到，而不是散落在三个调用点里。
 *
 * amagi 另有 `fetchUserProfile` / `fetchUserWorkList` / `fetchLiveRoomInfo`，
 * 本插件目前不用，属于新功能，另有安排。
 */
const KUAISHOU_METHODS = {
  videoWork: 'fetchVideoWork',
  comments: 'fetchWorkComments',
  emojiList: 'fetchEmojiList'
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
 * 所以正确的做法是让每个取数出口交出去的字段路径都和迁移前逐字节一致，
 * 消费侧（`Action` / `comments()`）一行都不用改。
 *
 * @param value amagi fetcher 的返回值，可能是 amagi 的 `Result`，也可能已经是裸响应
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
const fetchKuaishou = async (
  method: (typeof KUAISHOU_METHODS)[keyof typeof KUAISHOU_METHODS],
  options?: Record<string, unknown>
): Promise<unknown> => {
  // 按联合类型下标取方法会丢掉 amagi 的重载（只剩 2 参那条），所以收窄成本地调用签名
  const fetch = kuaishouFetcher[method] as (
    options: Record<string, unknown>,
    cookie: string,
    requestConfig: ReturnType<typeof buildAmagiRequestConfig>
  ) => Promise<unknown>
  const result = unwrapAmagiResult(await fetch(
    options ?? {},
    Config.cookies.kuaishou || KUAISHOU_GUEST_COOKIE,
    buildAmagiRequestConfig()
  ))
  if (!result || result === '') {
    logger.error('获取响应数据失败！\n请求类型：' + method)
  }
  return result
}

/**
 * 评论那一跳。给 `KuaiShou.Action` 的评论支线在闭包里自己调。
 *
 * **不能搬回 `GetData` 的 `Promise.all`**：那个 all 一条挂全挂，评论接口一抖
 * `GetData` 就 reject、`Action` 压根不会被调用，视频跟着一起不发 ——
 * `runMediaTasks` 的 allSettled 容错在 `Action` 内部，救不了 `Action` 之前
 * 就抛掉的取数。抖音的 `one_work` 踩过同一个坑（`fix(douyin): 评论取数搬进支线闭包`）。
 */
export const fetchKuaishouWorkComments = async (photoId: string | undefined): Promise<unknown> =>
  await fetchKuaishou(KUAISHOU_METHODS.comments, { photoId })

/** 表情表那一跳。同 {@link fetchKuaishouWorkComments}，只有评论卡要它 */
export const fetchKuaishouEmojiList = async (): Promise<unknown> =>
  await fetchKuaishou(KUAISHOU_METHODS.emojiList)

export default class KuaishouData {
  type: KuaishouDataType

  constructor (type: KuaishouDataType) {
    this.type = type
  }

  async GetData (data: { photoId?: string }): Promise<KuaishouWorkPayload | unknown> {
    switch (this.type) {
      case 'one_work':
      case '单个作品信息':
        // 只取作品本体。评论与表情由 `Action` 的评论支线自己取 —— 它们只有那张卡要用，
        // 留在这里会让两跳非必需的取数拥有掐死整条解析的权力（见上面那两个导出）。
        return {
          VideoData: await fetchKuaishou(KUAISHOU_METHODS.videoWork, { photoId: data.photoId }),
          photoId: data.photoId
        }

      case '作品评论信息':
        return await fetchKuaishouWorkComments(data.photoId)

      default:
        break
    }
  }
}
