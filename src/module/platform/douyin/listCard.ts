import { Common } from '@/module/utils/index'

/**
 * 喜欢列表 / 推荐列表两张推送卡片的数据构造。
 *
 * 照搬上游 `karin-plugin-kkk` 的 `renderFavoriteImage` / `renderRecommendImage`
 * （packages/core/src/platform/douyin/push/render.ts）。
 *
 * 这两个路由（`douyin/favorite-list`、`douyin/recommend-list`）连同模板一直随包
 * 构建，但本仓库从来没有调用点：favorite / recommend 两种推送类型都落到了通用的
 * `douyin/dynamic` 上。通用卡片只有一个作者区，而这两种推送的语义是
 * 「甲喜欢/推荐了乙的作品」——订阅者是甲、作品作者是乙。于是卡片上只剩乙，
 * 「谁喜欢的」这个信息整块丢掉，标题却写着「抖音喜欢列表推送」。
 * `Detail_Data.source_user_info` 就是为这个准备的，此前只写不读。
 *
 * 注意本仓库与上游的字段命名是**反的**：
 * - 上游：`user_info` 是订阅者，`author_user_info` 是作品作者
 * - 本仓库：`user_info` 是作品作者（getAuthorUserInfo 拉的），`source_user_info` 是订阅者
 *
 * 两个构造函数都刻意不写返回类型标注：让 TS 推出字面量形状，
 * `Render('douyin/favorite-list', …)` 调用点就会拿契约来校验它。
 */

/** 构造这两张卡片用到的用户字段 */
export interface DouyinListCardUser {
  avatar_larger?: { uri?: string, url_list?: string[] }
  avatar_thumb?: { uri?: string, url_list?: string[] }
  nickname?: string
  short_id?: string
  unique_id?: string
}

/** 作品互动数据 */
export interface DouyinListCardStatistics {
  collect_count?: number
  comment_count?: number
  digg_count?: number
  recommend_count?: number
  share_count?: number
}

/** 抖音号：优先 unique_id，退回 short_id */
const listCardDouyinId = (user: DouyinListCardUser | undefined): string =>
  user?.unique_id || user?.short_id || '无法获取'

/**
 * 头像：`url_list` 是直链，只有 `uri` 时才拼 CDN 前缀。
 * 与 `live.ts` 的 `liveAvatarUrl` 同源——上游一律 `cdnAvatar(uri)`，
 * 但作品作者对象上常常只有 `avatar_thumb.url_list`，拿 uri 拼会得到空路径。
 */
const listCardAvatar = (user: DouyinListCardUser | undefined): string => {
  for (const avatar of [user?.avatar_larger, user?.avatar_thumb]) {
    if (avatar?.url_list?.[0]) return avatar.url_list[0]
    if (avatar?.uri) return `https://p3-pc.douyinpic.com/aweme/1080x1080/${avatar.uri}`
  }
  return ''
}

/** 两张卡片共用的作品区字段 */
const buildListCardWorkFields = (options: {
  author: DouyinListCardUser | undefined
  coverUrl: string
  createTime: string
  desc: string
  shareUrl: string
  statistics: DouyinListCardStatistics | undefined
}) => {
  const { author, coverUrl, createTime, desc, shareUrl, statistics } = options
  return {
    image_url: coverUrl,
    // 与通用推送卡一致：空描述给个占位，别在卡片上留一片空白
    desc: desc || '该作品没有描述',
    dianzan: Common.count(statistics?.digg_count),
    pinglun: Common.count(statistics?.comment_count),
    shouchang: Common.count(statistics?.collect_count),
    share: Common.count(statistics?.share_count),
    tuijian: Common.count(statistics?.recommend_count),
    create_time: createTime,
    author_username: author?.nickname ?? '',
    author_avatar: listCardAvatar(author),
    author_douyin_id: listCardDouyinId(author),
    share_url: shareUrl
  }
}

/** 组装 `douyin/favorite-list` 契约要的数据 */
export const buildDouyinFavoritePayload = (options: {
  author: DouyinListCardUser | undefined
  coverUrl: string
  createTime: string
  desc: string
  /** 订阅者（点赞的人） */
  liker: DouyinListCardUser | undefined
  /** 订阅备注，取不到昵称时的展示名 */
  remark: string
  shareUrl: string
  statistics: DouyinListCardStatistics | undefined
}) => {
  const { liker, remark, ...work } = options
  return {
    ...buildListCardWorkFields(work),
    liker_username: remark || liker?.nickname || '',
    liker_avatar: listCardAvatar(liker),
    liker_douyin_id: listCardDouyinId(liker)
  }
}

/** 组装 `douyin/recommend-list` 契约要的数据 */
export const buildDouyinRecommendPayload = (options: {
  author: DouyinListCardUser | undefined
  coverUrl: string
  createTime: string
  desc: string
  /** 订阅者（被推荐来源） */
  recommender: DouyinListCardUser | undefined
  /** 订阅备注，取不到昵称时的展示名 */
  remark: string
  shareUrl: string
  statistics: DouyinListCardStatistics | undefined
}) => {
  const { recommender, remark, ...work } = options
  return {
    ...buildListCardWorkFields(work),
    recommender_username: remark || recommender?.nickname || '',
    recommender_avatar: listCardAvatar(recommender),
    recommender_douyin_id: listCardDouyinId(recommender)
  }
}
