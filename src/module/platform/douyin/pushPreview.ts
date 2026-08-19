import { Base, Common, Render } from '@/module/utils/index'
import { getDouyinID } from './getid.js'
import { getDouyinWorkCoverUrl, type DouyinAweme } from './workType.js'
import { getDouyinData } from './api.js'

/** 预览渲染结果 */
export type PushPreviewResult =
  | { ok: true, image: unknown }
  | { ok: false, message: string }

/** 支持预览的列表推送类型 */
export type PreviewListPushType = 'favorite' | 'recommend'

interface DouyinUser {
  nickname?: string
  unique_id?: string
  short_id?: string
  avatar_larger?: { url_list?: string[], uri?: string }
  follower_count?: number
  total_favorited?: number
  following_count?: number
  live_status?: number
  room_data?: string
  room_id_str?: string
}

interface PreviewAweme extends DouyinAweme {
  desc?: string
  create_time?: number
  share_url?: string
  author?: { sec_uid?: string, nickname?: string }
  statistics?: {
    digg_count?: number
    comment_count?: number
    share_count?: number
    collect_count?: number
  }
  video?: DouyinAweme['video'] & { play_addr?: { uri?: string } }
}

interface WorkDataResponse {
  data?: { aweme_detail?: PreviewAweme }
}

interface UserInfoResponse {
  data?: { user?: DouyinUser }
}

interface ListDataResponse {
  data?: { aweme_list?: PreviewAweme[] }
}

interface LiveItem {
  title?: string
  cover?: { url_list?: string[] }
  room_view_stats?: { display_value?: number | string }
  stats?: { total_user_str?: number | string }
}

interface LiveDataResponse {
  data?: {
    data?: {
      data?: LiveItem[] | LiveItem
      partition_road_map?: { partition?: { title?: string } }
    } & LiveItem[]
    partition_road_map?: { partition?: { title?: string } }
  }
}

/** amagi 客户端上被预览逻辑使用的方法 */
interface PreviewAmagi {
  getDouyinData: (method: string, options: Record<string, unknown>) => Promise<unknown>
}

const getAweme = (workData: WorkDataResponse | undefined): PreviewAweme | undefined =>
  workData?.data?.aweme_detail

const getUser = (userInfo: UserInfoResponse | undefined): DouyinUser =>
  userInfo?.data?.user || {}

const avatarUrl = (user: DouyinUser | undefined): string =>
  user?.avatar_larger?.url_list?.[0] || (user?.avatar_larger?.uri ? `https://p3-pc.douyinpic.com/aweme/1080x1080/${user.avatar_larger.uri}` : '')

const douyinId = (user: DouyinUser | { sec_uid?: string, nickname?: string } | undefined): string => {
  const record = user as DouyinUser | undefined
  return record?.unique_id || record?.short_id || ''
}

const buildWorkShareLink = (aweme: PreviewAweme | undefined, fallbackUrl: string): string | undefined => {
  const videoId = aweme?.video?.play_addr?.uri
  if (videoId) return `https://aweme.snssdk.com/aweme/v1/play/?video_id=${videoId}&ratio=1080p&line=0`
  return aweme?.share_url || fallbackUrl
}

const pushTypeLabels: Record<PreviewListPushType, string> = {
  favorite: '喜欢列表',
  recommend: '推荐列表'
}

const getLiveItem = (liveData: LiveDataResponse | undefined): LiveItem => {
  const nested = liveData?.data?.data
  const fromNestedArray = Array.isArray(nested?.data) ? nested?.data?.[0] : undefined
  const fromDataArray = Array.isArray(nested) ? nested[0] : undefined
  const fromNestedObject = !Array.isArray(nested?.data) ? nested?.data : undefined
  return fromNestedArray || fromDataArray || fromNestedObject || {}
}

const getPartitionTitle = (liveData: LiveDataResponse | undefined, liveItem: LiveItem): string =>
  liveData?.data?.data?.partition_road_map?.partition?.title ||
  liveData?.data?.partition_road_map?.partition?.title ||
  liveItem?.title ||
  '未知分区'

export class DouyinPushPreview extends Base {
  /** amagi 客户端，访问方式与旧实现一致 */
  private get client (): PreviewAmagi {
    return this.amagi as unknown as PreviewAmagi
  }

  async renderWork (url: string): Promise<PushPreviewResult> {
    const iddata = await getDouyinID(url, false)
    if (iddata.type !== 'one_work' || !iddata.aweme_id) {
      return { ok: false, message: '该链接不是作品链接，请提供视频/图集/文章链接' }
    }

    const workData = await this.client.getDouyinData('聚合解析', {
      aweme_id: iddata.aweme_id,
      typeMode: 'strict'
    }) as WorkDataResponse
    const aweme = getAweme(workData)
    if (!aweme) return { ok: false, message: '获取作品详情失败，作品可能已被删除或设为私密' }

    const userInfo = await this.client.getDouyinData('用户主页数据', {
      sec_uid: aweme.author?.sec_uid,
      typeMode: 'strict'
    }) as UserInfoResponse
    const user = getUser(userInfo)

    const image = await Render('douyin/dynamic', {
      image_url: getDouyinWorkCoverUrl(aweme),
      desc: aweme.desc || '该作品没有描述',
      dianzan: Common.count(aweme.statistics?.digg_count),
      pinglun: Common.count(aweme.statistics?.comment_count),
      share: Common.count(aweme.statistics?.share_count),
      shouchang: Common.count(aweme.statistics?.collect_count),
      create_time: Common.convertTimestampToDateTime(aweme.create_time as number),
      avater_url: avatarUrl(user),
      share_url: buildWorkShareLink(aweme, url),
      username: aweme.author?.nickname || user.nickname || '未知用户',
      抖音号: douyinId(user || aweme.author),
      粉丝: Common.count(user.follower_count),
      获赞: Common.count(user.total_favorited),
      关注: Common.count(user.following_count),
      dynamicTYPE: '抖音作品推送'
    })

    return { ok: true, image }
  }

  async renderList (pushType: PreviewListPushType, url: string): Promise<PushPreviewResult> {
    const iddata = await getDouyinID(url, false)
    if (iddata.type !== 'user_dynamic' || !iddata.sec_uid) {
      return { ok: false, message: `需要用户主页链接以测试${pushTypeLabels[pushType]}推送` }
    }

    const userInfo = await this.client.getDouyinData('用户主页数据', {
      sec_uid: iddata.sec_uid,
      typeMode: 'strict'
    }) as UserInfoResponse
    const listData = await getDouyinData(
      pushType === 'favorite' ? 'fetchUserFavoriteList' : 'fetchUserRecommendList',
      { sec_uid: iddata.sec_uid, number: 1, typeMode: 'strict' }
    ) as ListDataResponse

    const aweme = listData?.data?.aweme_list?.[0]
    if (!aweme) return { ok: false, message: `${getUser(userInfo).nickname || '该用户'} 的${pushTypeLabels[pushType]}为空或未公开` }

    let authorInfo = userInfo
    if (aweme.author?.sec_uid) {
      authorInfo = await this.client.getDouyinData('用户主页数据', {
        sec_uid: aweme.author.sec_uid,
        typeMode: 'strict'
      }) as UserInfoResponse
    }
    const author = getUser(authorInfo)
    const image = await Render('douyin/dynamic', {
      image_url: getDouyinWorkCoverUrl(aweme),
      desc: aweme.desc || '该作品没有描述',
      dianzan: Common.count(aweme.statistics?.digg_count),
      pinglun: Common.count(aweme.statistics?.comment_count),
      share: Common.count(aweme.statistics?.share_count),
      shouchang: Common.count(aweme.statistics?.collect_count),
      create_time: Common.convertTimestampToDateTime(aweme.create_time as number),
      avater_url: avatarUrl(author),
      share_url: buildWorkShareLink(aweme, aweme.share_url || url),
      username: aweme.author?.nickname || author.nickname || '未知用户',
      抖音号: douyinId(author || aweme.author),
      粉丝: Common.count(author.follower_count),
      获赞: Common.count(author.total_favorited),
      关注: Common.count(author.following_count),
      dynamicTYPE: `抖音${pushTypeLabels[pushType]}测试推送`
    })

    return { ok: true, image }
  }

  async renderLive (url: string): Promise<PushPreviewResult> {
    const iddata = await getDouyinID(url, false)
    if (iddata.type !== 'user_dynamic' && iddata.type !== 'live_room_detail') {
      return { ok: false, message: '需要用户主页链接以检查直播状态' }
    }

    if (!iddata.sec_uid) {
      return { ok: false, message: '旧版链接解析器无法从直播间直链反查 sec_uid，请提供用户主页分享链接' }
    }

    const userInfo = await this.client.getDouyinData('用户主页数据', {
      sec_uid: iddata.sec_uid,
      typeMode: 'strict'
    }) as UserInfoResponse
    const user = getUser(userInfo)
    if (user.live_status !== 1) return { ok: false, message: `${user.nickname || '该用户'} 当前未在直播` }
    if (!user.room_data) return { ok: false, message: '未获取到直播间信息' }

    const roomData = JSON.parse(user.room_data) as { owner?: { web_rid?: string } }
    const liveData = await getDouyinData('直播间信息数据', {
      room_id: user.room_id_str,
      web_rid: roomData.owner!.web_rid,
      typeMode: 'strict'
    }) as LiveDataResponse
    const liveItem = getLiveItem(liveData)
    const webRid = roomData?.owner?.web_rid || iddata.room_id || ''

    const image = await Render('douyin/live', {
      image_url: [{ image_src: liveItem?.cover?.url_list?.[0] || '' }],
      text: liveItem?.title || '',
      liveinf: `${getPartitionTitle(liveData, liveItem)} | 房间号: ${webRid}`,
      在线观众: Common.count(Number(liveItem?.room_view_stats?.display_value || 0)),
      总观看次数: Common.count(Number(liveItem?.stats?.total_user_str || 0)),
      username: user.nickname || '未知用户',
      avater_url: avatarUrl(user),
      fans: Common.count(user.follower_count),
      create_time: Common.convertTimestampToDateTime(Date.now() / 1000),
      now_time: Common.convertTimestampToDateTime(Date.now() / 1000),
      share_url: `https://live.douyin.com/${webRid}`,
      dynamicTYPE: '直播状态测试推送'
    })

    return { ok: true, image }
  }
}
