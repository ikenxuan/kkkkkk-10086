import { Base, Common, Config, Render } from '../../../module/utils/index.js';
import { getDouyinID } from './getid.js';
import { buildDouyinLivePayload } from './live.js';
import { getDouyinWorkCoverUrl } from './workType.js';
import { buildAmagiRequestConfig, douyinFetcher } from '../../../module/utils/amagiClient.js';
const getAweme = (workData) => workData?.data?.aweme_detail;
const getUser = (userInfo) => userInfo?.data?.user || {};
const avatarUrl = (user) => user?.avatar_larger?.url_list?.[0] || (user?.avatar_larger?.uri ? `https://p3-pc.douyinpic.com/aweme/1080x1080/${user.avatar_larger.uri}` : '');
const douyinId = (user) => {
    const record = user;
    return record?.unique_id || record?.short_id || '';
};
/** 契约里 share_url 必填 string、模板拿它做二维码，所以最后一定要落到一个非空地址 */
const buildWorkShareLink = (aweme, fallbackUrl) => {
    const videoId = aweme?.video?.play_addr?.uri;
    if (videoId)
        return `https://aweme.snssdk.com/aweme/v1/play/?video_id=${videoId}&ratio=1080p&line=0`;
    return aweme?.share_url || fallbackUrl;
};
const pushTypeLabels = {
    favorite: '喜欢列表',
    recommend: '推荐列表'
};
const getLiveItem = (liveData) => {
    const nested = liveData?.data?.data;
    const fromNestedArray = Array.isArray(nested?.data) ? nested?.data?.[0] : undefined;
    const fromDataArray = Array.isArray(nested) ? nested[0] : undefined;
    const fromNestedObject = !Array.isArray(nested?.data) ? nested?.data : undefined;
    return fromNestedArray || fromDataArray || fromNestedObject || {};
};
/** 只负责分区名，取不到就交给 buildDouyinLivePayload 兜底（标题 → 未知分区） */
const getPartitionTitle = (liveData) => liveData?.data?.data?.partition_road_map?.partition?.title ||
    liveData?.data?.partition_road_map?.partition?.title ||
    '';
export class DouyinPushPreview extends Base {
    async renderWork(url) {
        const iddata = await getDouyinID(url, false);
        if (iddata.type !== 'one_work' || !iddata.aweme_id) {
            return { ok: false, message: '该链接不是作品链接，请提供视频/图集/文章链接' };
        }
        const workData = await douyinFetcher.parseWork({
            aweme_id: iddata.aweme_id,
            typeMode: 'strict'
        }, Config.cookies.douyin, buildAmagiRequestConfig());
        const aweme = getAweme(workData);
        if (!aweme)
            return { ok: false, message: '获取作品详情失败，作品可能已被删除或设为私密' };
        const userInfo = await douyinFetcher.fetchUserProfile({
            sec_uid: aweme.author?.sec_uid ?? '',
            typeMode: 'strict'
        }, Config.cookies.douyin, buildAmagiRequestConfig());
        const user = getUser(userInfo);
        const image = await Render('douyin/dynamic', {
            image_url: getDouyinWorkCoverUrl(aweme),
            desc: aweme.desc || '该作品没有描述',
            dianzan: Common.count(aweme.statistics?.digg_count),
            pinglun: Common.count(aweme.statistics?.comment_count),
            share: Common.count(aweme.statistics?.share_count),
            shouchang: Common.count(aweme.statistics?.collect_count),
            create_time: Common.convertTimestampToDateTime(aweme.create_time),
            avater_url: avatarUrl(user),
            share_url: buildWorkShareLink(aweme, url),
            username: aweme.author?.nickname || user.nickname || '未知用户',
            抖音号: douyinId(user || aweme.author),
            粉丝: Common.count(user.follower_count),
            获赞: Common.count(user.total_favorited),
            关注: Common.count(user.following_count),
            dynamicTYPE: '抖音作品推送'
        });
        return { ok: true, image };
    }
    async renderList(pushType, url) {
        const iddata = await getDouyinID(url, false);
        if (iddata.type !== 'user_dynamic' || !iddata.sec_uid) {
            return { ok: false, message: `需要用户主页链接以测试${pushTypeLabels[pushType]}推送` };
        }
        const userInfo = await douyinFetcher.fetchUserProfile({
            sec_uid: iddata.sec_uid,
            typeMode: 'strict'
        }, Config.cookies.douyin, buildAmagiRequestConfig());
        const fetchList = pushType === 'favorite'
            ? douyinFetcher.fetchUserFavoriteList
            : douyinFetcher.fetchUserRecommendList;
        const listData = await fetchList({ sec_uid: iddata.sec_uid, number: 1, typeMode: 'strict' }, Config.cookies.douyin, buildAmagiRequestConfig());
        const aweme = listData?.data?.aweme_list?.[0];
        if (!aweme)
            return { ok: false, message: `${getUser(userInfo).nickname || '该用户'} 的${pushTypeLabels[pushType]}为空或未公开` };
        let authorInfo = userInfo;
        if (aweme.author?.sec_uid) {
            authorInfo = await douyinFetcher.fetchUserProfile({
                sec_uid: aweme.author.sec_uid,
                typeMode: 'strict'
            }, Config.cookies.douyin, buildAmagiRequestConfig());
        }
        const author = getUser(authorInfo);
        const image = await Render('douyin/dynamic', {
            image_url: getDouyinWorkCoverUrl(aweme),
            desc: aweme.desc || '该作品没有描述',
            dianzan: Common.count(aweme.statistics?.digg_count),
            pinglun: Common.count(aweme.statistics?.comment_count),
            share: Common.count(aweme.statistics?.share_count),
            shouchang: Common.count(aweme.statistics?.collect_count),
            create_time: Common.convertTimestampToDateTime(aweme.create_time),
            avater_url: avatarUrl(author),
            share_url: buildWorkShareLink(aweme, aweme.share_url || url),
            username: aweme.author?.nickname || author.nickname || '未知用户',
            抖音号: douyinId(author || aweme.author),
            粉丝: Common.count(author.follower_count),
            获赞: Common.count(author.total_favorited),
            关注: Common.count(author.following_count),
            dynamicTYPE: `抖音${pushTypeLabels[pushType]}测试推送`
        });
        return { ok: true, image };
    }
    async renderLive(url) {
        const iddata = await getDouyinID(url, false);
        if (iddata.type !== 'user_dynamic' && iddata.type !== 'live_room_detail') {
            return { ok: false, message: '需要用户主页链接以检查直播状态' };
        }
        if (!iddata.sec_uid) {
            return { ok: false, message: '旧版链接解析器无法从直播间直链反查 sec_uid，请提供用户主页分享链接' };
        }
        const userInfo = await douyinFetcher.fetchUserProfile({
            sec_uid: iddata.sec_uid,
            typeMode: 'strict'
        }, Config.cookies.douyin, buildAmagiRequestConfig());
        const user = getUser(userInfo);
        if (user.live_status !== 1)
            return { ok: false, message: `${user.nickname || '该用户'} 当前未在直播` };
        if (!user.room_data)
            return { ok: false, message: '未获取到直播间信息' };
        const roomData = JSON.parse(user.room_data);
        const liveData = await douyinFetcher.fetchLiveRoomInfo({
            room_id: user.room_id_str ?? '',
            web_rid: roomData.owner?.web_rid ?? '',
            typeMode: 'strict'
        }, Config.cookies.douyin, buildAmagiRequestConfig());
        const liveItem = getLiveItem(liveData);
        const webRid = roomData?.owner?.web_rid || iddata.room_id || '';
        const image = await Render('douyin/live', buildDouyinLivePayload({
            anchor: user,
            dynamicTYPE: '直播状态测试推送',
            liveItem,
            partitionTitle: getPartitionTitle(liveData),
            webRid
        }));
        return { ok: true, image };
    }
}
