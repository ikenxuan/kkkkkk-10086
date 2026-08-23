import { Base, Config, UploadRecord, Networks, Render, Common, downloadFile, downloadVideo, uploadFile, baseHeaders, processImageUrl, sanitizeFilenameSegment } from '../../../module/utils/index.js';
import { runMediaTasks } from '../../../module/utils/MediaTasks.js';
import { fromMilliseconds, reportMedia } from '../../../module/utils/media-metrics.js';
import common from '../../../runtime/host/common.js';
import { burnDouyinDanmaku } from './danmaku.js';
import { buildLivePhotoMessages, buildLivePhotoTipMessage } from '../../../module/platform/common/livePhoto.js';
import { douyinCommentLimit } from '../../../module/platform/common/commentLimit.js';
import { douyinComments } from './index.js';
import { renderWorkImage } from './render.js';
import { buildDouyinLivePayload } from './live.js';
import { getDouyinWorkCoverUrl, isDouyinArticle, isDouyinVideo } from './workType.js';
import fs from 'fs';
const isRecord = (value) => typeof value === 'object' && value !== null;
const isDouyinDataType = (value) => [
    'one_work',
    'work_comments',
    'user_mix_videos',
    'user_dynamic',
    'user_profile',
    'live_room_detail',
    'liveroom_def',
    'emoji_list',
    'music_work',
    'suggest_words',
    'search_info',
    'undefined'
].includes(value);
const narrowApiResponse = (value, label) => {
    if (!isRecord(value))
        throw new Error(`${label}返回格式异常`);
    return value;
};
const getUploadRecordEvent = (event) => {
    if (!isRecord(event.bot))
        throw new Error('消息事件缺少机器人实例');
    return event;
};
const getLivePayload = (response) => {
    const responseData = response.data;
    const payload = isRecord(responseData.data) ? responseData.data : responseData;
    const items = Array.isArray(payload.data)
        ? payload.data.filter((item) => isRecord(item))
        : [];
    const partition = isRecord(payload.partition_road_map)
        ? payload.partition_road_map
        : {};
    return { items, partition };
};
let mp4size = '';
let img;
const getFirstUrl = (data) => data?.url_list?.find(Boolean) || '';
const formatVideoStats = (statistics = {}) => [
    `\n点赞：${Common.count(statistics.digg_count)}`,
    `评论：${Common.count(statistics.comment_count)}`,
    `收藏：${Common.count(statistics.collect_count)}`,
    `分享：${Common.count(statistics.share_count)}`,
    statistics.recommend_count !== undefined ? `推荐：${Common.count(statistics.recommend_count)}` : ''
].filter(Boolean).join('\n');
const hasUserConfigKey = (key) => Object.prototype.hasOwnProperty.call(Config.getConfig('douyin') || {}, key);
const hasDouyinContent = (legacyKey, modernKey) => {
    const sendContent = Config.douyin.sendContent;
    if (modernKey && hasUserConfigKey('sendContent') && Array.isArray(sendContent) && sendContent.length > 0) {
        return sendContent.includes(modernKey);
    }
    return (Config.douyin.douyinTip || []).includes(legacyKey);
};
const getDouyinMusicUrl = (music) => {
    if (!music)
        return '';
    if (music.play_url?.uri)
        return music.play_url.uri;
    try {
        const extra = JSON.parse(music.extra || '{}');
        return isRecord(extra) && typeof extra.original_song_url === 'string' ? extra.original_song_url : '';
    }
    catch {
        return '';
    }
};
const getDouyinLiveVideoUrl = (imageItem) => {
    const uri = imageItem?.video?.play_addr_h264?.uri || imageItem?.video?.play_addr?.uri;
    return uri ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${uri}&ratio=1080p&line=0` : '';
};
export class DouYin extends Base {
    type;
    is_mp4;
    is_slides;
    forceBurnDanmaku;
    hasProcessedLiveImage;
    constructor(e, iddata, options) {
        super(e);
        if (!e.reply)
            throw new Error('抖音解析事件缺少回复方法');
        this.e = e;
        this.type = isDouyinDataType(iddata.type) ? iddata.type : 'undefined';
        this.is_mp4 = iddata?.is_mp4;
        this.is_slides = false;
        this.forceBurnDanmaku = options?.forceBurnDanmaku ?? false;
        this.hasProcessedLiveImage = false;
    }
    async RESOURCES(data) {
        try {
            if (this.type === 'undefined')
                return true;
            if (Config.app.parseTip || hasDouyinContent('提示信息')) {
                await this.e.reply('检测到抖音链接，开始解析');
            }
            switch (this.type) {
                case 'one_work': {
                    const VideoResponse = narrowApiResponse(await this.amagi.getDouyinData('聚合解析', {
                        aweme_id: data.aweme_id,
                        typeMode: 'strict'
                    }), '作品详情');
                    if (VideoResponse.data.aweme_detail === null) {
                        throw new Error('获取作品详情失败，可能是因为该作品已被删除或设置为私密。');
                    }
                    const VideoData = { data: { aweme_detail: VideoResponse.data.aweme_detail } };
                    const isArticle = isDouyinArticle(VideoData.data.aweme_detail);
                    const isVideo = isDouyinVideo(VideoData.data.aweme_detail);
                    if (typeof this.is_mp4 !== 'boolean')
                        this.is_mp4 = isVideo;
                    const CommentsData = narrowApiResponse(await this.amagi.getDouyinData('评论数据', {
                        aweme_id: data.aweme_id,
                        // 面板上「评论解析数量」写的是新键 douyin.numcomment，这里原来只读旧键 numcomments，
                        // 于是用户在面板里改了数量却没有任何效果。走 helper 统一「新键优先、旧键兜底」。
                        number: douyinCommentLimit(),
                        typeMode: 'strict'
                    }), '评论数据');
                    let emojiListPromise;
                    const getEmojiList = () => {
                        emojiListPromise ??= (async () => {
                            try {
                                const emojiData = narrowApiResponse(await this.amagi.getDouyinData('Emoji数据', { typeMode: 'strict' }), 'Emoji数据');
                                return Emoji(emojiData.data).filter((item) => typeof item.url === 'string' && item.url.length > 0);
                            }
                            catch (error) {
                                logger.warn('[抖音] 获取表情列表失败，降级为纯文字', error);
                                return [];
                            }
                        })();
                        return emojiListPromise;
                    };
                    this.is_slides = VideoData.data.aweme_detail.is_slides === true;
                    let g_video_url = '';
                    let g_title;
                    /** 图集 */
                    let imagenum = 0;
                    const image_res = [];
                    if (!isVideo && !isArticle && hasDouyinContent('图集')) {
                        switch (true) {
                            // 图集
                            case this.is_slides === false && VideoData.data.aweme_detail.images !== null: {
                                const image_data = [];
                                const imageres = [];
                                let image_url = '';
                                // 使用可选链和空值合并操作符确保安全访问
                                const images = VideoData.data.aweme_detail.images || [];
                                const hasLiveImage = images.some(item => (item.clip_type ?? 2) !== 2);
                                const title = sanitizeFilenameSegment(VideoData.data.aweme_detail.preview_title, 50, '抖音图集');
                                g_title = title;
                                if (hasLiveImage) {
                                    const processedImages = [];
                                    const temp = [];
                                    let hasGeneratedLivePhoto = false;
                                    let bgmContext;
                                    const mergeMode = Config.douyin.liveImageMergeMode || 'independent';
                                    const musicUrl = getDouyinMusicUrl(VideoData.data.aweme_detail.music);
                                    const liveimgbgm = musicUrl
                                        ? await downloadFile(musicUrl, {
                                            title: `Douyin_tmp_A_${Date.now()}.mp3`,
                                            headers: {
                                                ...this.headers,
                                                Referer: 'https://www.douyin.com/',
                                                Cookie: ''
                                            }
                                        })
                                        : null;
                                    if (liveimgbgm?.filepath)
                                        temp.push(liveimgbgm);
                                    for (const [index, imageItem] of images.entries()) {
                                        imagenum++;
                                        if (imageItem.clip_type === 2 || imageItem.clip_type === undefined) {
                                            image_url = imageItem.url_list?.[2] || imageItem.url_list?.[1] || imageItem.url_list?.[0] || '';
                                            const processedImageUrl = await processImageUrl(image_url, g_title, index, {
                                                Referer: 'https://www.douyin.com/',
                                                Cookie: Config.cookies.douyin || ''
                                            });
                                            processedImages.push(segment.image(processedImageUrl));
                                            continue;
                                        }
                                        const livePhoto = await buildLivePhotoMessages({
                                            platform: 'douyin',
                                            staticUrl: imageItem.url_list?.[0] || imageItem.url_list?.[2] || imageItem.url_list?.[1],
                                            liveVideoUrl: getDouyinLiveVideoUrl(imageItem),
                                            index,
                                            headers: {
                                                ...this.headers,
                                                Referer: 'https://www.douyin.com/',
                                                Cookie: ''
                                            },
                                            bgmPath: liveimgbgm?.filepath,
                                            mergeMode,
                                            context: bgmContext,
                                            loopCount: imageItem.clip_type === 4 ? 1 : 3
                                        });
                                        bgmContext = livePhoto.context || bgmContext;
                                        temp.push(...livePhoto.tempFiles);
                                        hasGeneratedLivePhoto = hasGeneratedLivePhoto || livePhoto.generatedLivePhoto;
                                        if (livePhoto.messages.length > 0) {
                                            processedImages.push(...livePhoto.messages);
                                        }
                                        else if (imageItem.url_list?.[0]) {
                                            const imageUrl = await processImageUrl(imageItem.url_list[0], g_title, index, {
                                                Referer: 'https://www.douyin.com/',
                                                Cookie: Config.cookies.douyin || ''
                                            });
                                            processedImages.push(segment.image(imageUrl));
                                        }
                                    }
                                    if (hasGeneratedLivePhoto)
                                        processedImages.push(await buildLivePhotoTipMessage());
                                    try {
                                        await this.e.reply(await common.makeForwardMsg(this.e, processedImages, '图集内容'));
                                    }
                                    finally {
                                        for (const item of temp)
                                            await Common.removeFile(item.filepath, true);
                                    }
                                    this.hasProcessedLiveImage = true;
                                    break;
                                }
                                for (const [index, imageItem] of images.entries()) {
                                    // 获取图片地址，优先使用第三个URL，其次使用第二个URL
                                    image_url = imageItem.url_list[2] || imageItem.url_list[1] || '';
                                    // 处理标题，去除特殊字符
                                    const processedImageUrl = await processImageUrl(image_url, title, index, {
                                        Referer: 'https://www.douyin.com/',
                                        Cookie: Config.cookies.douyin || ''
                                    });
                                    imageres.push(segment.image(processedImageUrl));
                                    imagenum++;
                                    if (Config.app.removeCache === false) {
                                        Common.mkdir(`${Common.tempDri.images}${g_title}`);
                                        const path = `${Common.tempDri.images}${g_title}/${index + 1}.png`;
                                        await new Networks({ url: image_url, type: 'arraybuffer' }).getData().then((data) => fs.promises.writeFile(path, data));
                                    }
                                }
                                const res = common.makeForwardMsg(this.e, imageres, '解析完的图集图片');
                                image_data.push(res);
                                image_res.push(image_data);
                                if (imageres.length === 1) {
                                    await this.e.reply(segment.image(await processImageUrl(image_url, g_title, 0, {
                                        Referer: 'https://www.douyin.com/',
                                        Cookie: Config.cookies.douyin || ''
                                    })));
                                }
                                else {
                                    await this.e.reply(res);
                                }
                                break;
                            }
                            // 合辑
                            case VideoData.data.aweme_detail.is_slides === true && VideoData.data.aweme_detail.images !== null: {
                                const images = [];
                                const temp = [];
                                let hasGeneratedLivePhoto = false;
                                let bgmContext;
                                const mergeMode = Config.douyin.liveImageMergeMode || 'independent';
                                const musicUrl = getDouyinMusicUrl(VideoData.data.aweme_detail.music);
                                const liveimgbgm = musicUrl
                                    ? await downloadFile(musicUrl, {
                                        title: `Douyin_tmp_A_${Date.now()}.mp3`,
                                        headers: {
                                            ...this.headers,
                                            Referer: 'https://www.douyin.com/',
                                            Cookie: ''
                                        }
                                    })
                                    : null;
                                if (liveimgbgm?.filepath)
                                    temp.push(liveimgbgm);
                                const images1 = VideoData.data.aweme_detail.images || [];
                                if (!images1.length) {
                                    logger.debug('未获取到合辑的图片数据');
                                }
                                g_title = sanitizeFilenameSegment(VideoData.data.aweme_detail.preview_title, 50, '抖音图集');
                                for (const [index, item] of images1.entries()) {
                                    imagenum++;
                                    // 静态图片，clip_type为2或undefined
                                    if (item.clip_type === 2 || item.clip_type === undefined) {
                                        if (item.url_list[0]) {
                                            const processedImageUrl = await processImageUrl(item.url_list[0], VideoData.data.aweme_detail.preview_title || '抖音图集', imagenum, {
                                                Referer: 'https://www.douyin.com/',
                                                Cookie: Config.cookies.douyin || ''
                                            });
                                            images.push(segment.image(processedImageUrl));
                                        }
                                        continue;
                                    }
                                    const livePhoto = await buildLivePhotoMessages({
                                        platform: 'douyin',
                                        staticUrl: item.url_list?.[0] || item.url_list?.[2] || item.url_list?.[1],
                                        liveVideoUrl: getDouyinLiveVideoUrl(item),
                                        index,
                                        headers: {
                                            ...this.headers,
                                            Referer: 'https://www.douyin.com/',
                                            Cookie: ''
                                        },
                                        bgmPath: liveimgbgm?.filepath,
                                        mergeMode,
                                        context: bgmContext,
                                        loopCount: item.clip_type === 4 ? 1 : 3
                                    });
                                    bgmContext = livePhoto.context || bgmContext;
                                    temp.push(...livePhoto.tempFiles);
                                    hasGeneratedLivePhoto = hasGeneratedLivePhoto || livePhoto.generatedLivePhoto;
                                    if (livePhoto.messages.length > 0) {
                                        images.push(...livePhoto.messages);
                                    }
                                    else if (item.url_list?.[0]) {
                                        const imageUrl = await processImageUrl(item.url_list[0], g_title, index, {
                                            Referer: 'https://www.douyin.com/',
                                            Cookie: Config.cookies.douyin || ''
                                        });
                                        images.push(segment.image(imageUrl));
                                    }
                                }
                                if (hasGeneratedLivePhoto)
                                    images.push(await buildLivePhotoTipMessage());
                                const Element = common.makeForwardMsg(this.e, images, '合辑内容');
                                try {
                                    await this.e.reply(Element);
                                }
                                catch (error) {
                                    logger.error(error);
                                }
                                finally {
                                    for (const item of temp) {
                                        await Common.removeFile(item.filepath, true);
                                    }
                                }
                                this.hasProcessedLiveImage = true;
                                break;
                            }
                        }
                    }
                    /** 背景音乐 */
                    if (!isArticle && VideoData.data.aweme_detail.music && hasDouyinContent('背景音乐') && !this.hasProcessedLiveImage) {
                        const music = VideoData.data.aweme_detail.music;
                        const music_url = getDouyinMusicUrl(music); // BGM link
                        if (this.is_mp4 === false && Config.app.removeCache === false && music_url !== undefined) {
                            try {
                                const path = Common.tempDri.images + `${g_title}/BGM.mp3`;
                                await new Networks({ url: music_url, type: 'arraybuffer' }).getData().then((data) => fs.promises.writeFile(path, data));
                            }
                            catch (error) {
                                logger.error(error);
                            }
                        }
                        const haspath = music_url && this.is_mp4 === false && music_url !== undefined;
                        if (haspath) {
                            await this.e.reply(await UploadRecord(getUploadRecordEvent(this.e), music_url, 0, !Config.douyin.sendHDrecord));
                        }
                    }
                    /** 视频 */
                    let FPS;
                    const sendvideofile = true;
                    let video = null;
                    let cover = '';
                    if (isVideo) {
                        // 视频地址特殊判断：play_addr_h264、play_addr、
                        video = VideoData.data.aweme_detail.video;
                        // 契约里 VideoFPS 是 number；原来拿不到时给 '获取失败'，模板那句
                        // `{props.VideoFPS}Hz` 没有守卫，会印成「获取失败Hz」
                        FPS = Number(video.bit_rate[0]?.FPS) || undefined;
                        if (Config.douyin.autoResolution) {
                            logger.debug(`开始排除不符合条件的视频分辨率；\n
              共拥有${logger.yellow(video.bit_rate.length)}个视频源\n
              视频ID：${logger.green(VideoData.data.aweme_detail.aweme_id)}\n
              分享链接：${logger.green(VideoData.data.aweme_detail.share_url)}
              `);
                            video.bit_rate = douyinProcessVideos(video.bit_rate, Config.upload.filelimit || 100);
                            g_video_url = await new Networks({
                                url: video.bit_rate[0].play_addr.url_list[2] || '',
                                headers: {
                                    ...this.headers,
                                    Referer: video.bit_rate[0].play_addr.url_list[0] || '',
                                    Cookie: ''
                                }
                            }).getLongLink();
                        }
                        else {
                            g_video_url = await new Networks({
                                url: video.play_addr_h264.url_list[2] || '',
                                headers: {
                                    ...this.headers,
                                    Referer: video.play_addr_h264.url_list[0] || video.play_addr_h264.url_list[0],
                                    Cookie: ''
                                }
                            }).getLongLink();
                        }
                        cover = getFirstUrl(video.animated_cover) || getFirstUrl(video.dynamic_cover) || getFirstUrl(video.cover_original_scale) || getFirstUrl(video.cover) || getFirstUrl(video.origin_cover);
                        const title = sanitizeFilenameSegment(VideoData.data.aweme_detail.preview_title, 80, '抖音视频'); // video title
                        g_title = title;
                        mp4size = (video.bit_rate[0].play_addr.data_size / (1024 * 1024)).toFixed(2);
                        logger.info('视频地址', `https://aweme.snssdk.com/aweme/v1/play/?video_id=${VideoData.data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`);
                    }
                    // 上游这里只看 sendContent 是否含 'info'，不看作品类型（up douyin.ts:568）。
                    // renderWorkImage() 是 douyin/image-work 与 douyin/article-work 的唯一入口，
                    // 加上 `isVideo &&` 之后图集/合辑/文章就再也走不到它，整张作品信息图连带封面
                    // 根本不生成 —— 这正是「非视频类型封面渲染不出来」的真因。
                    const sendVideoInfo = hasDouyinContent('视频', 'info')
                        ? async () => {
                            const aweme = VideoData.data.aweme_detail;
                            const statistics = aweme.statistics || {};
                            const displayContent = Config.douyin.displayContent || ['cover', 'title', 'author', 'stats'];
                            if (Config.douyin.videoInfoMode === 'text') {
                                // `cover` 声明在上方 `let cover = ''`，只在 `if (isVideo)` 里赋过值，
                                // 图集/合辑/文章走到这里还是空串，segment.image('') 等于没有封面。
                                // 按上游 up douyin.ts:573-577 的三分支各自取封面。
                                const coverImageUrl = isArticle
                                    ? getFirstUrl(aweme.video?.origin_cover)
                                    : isVideo
                                        ? cover
                                        : getFirstUrl(aweme.images?.[0]);
                                const processedCover = await processImageUrl(coverImageUrl, aweme.desc || g_title || '抖音作品封面', 0, {
                                    Referer: 'https://www.douyin.com/',
                                    Cookie: Config.cookies.douyin || ''
                                });
                                const contentMap = {
                                    cover: segment.image(processedCover),
                                    title: `\n标题：${aweme.desc || g_title}\n`,
                                    author: `\n作者：${aweme.author?.nickname || '无法获取'}\n`,
                                    stats: formatVideoStats(statistics)
                                };
                                const replyContent = [];
                                for (const item of Object.keys(contentMap)) {
                                    if (displayContent.includes(item) && contentMap[item])
                                        replyContent.push(contentMap[item]);
                                }
                                if (replyContent.length)
                                    await this.e.reply(replyContent);
                            }
                            else {
                                let userProfile;
                                try {
                                    const userProfileData = narrowApiResponse(await this.amagi.getDouyinData('用户主页数据', {
                                        sec_uid: aweme.author.sec_uid,
                                        typeMode: 'strict'
                                    }), '用户主页数据');
                                    userProfile = userProfileData.data.user;
                                }
                                catch (error) {
                                    logger.warn('[抖音] 获取作者主页信息失败，继续渲染视频信息图', error);
                                }
                                const workInfoImg = await renderWorkImage({
                                    // 上游把 fetchUserProfile() 的整条响应原样挂在 user_info 上，这里已经取到
                                    // .data.user 了，所以按模板契约再包回去，render.ts 才读得到主页的高清头像和粉丝数。
                                    Detail_Data: userProfile ? { ...aweme, user_info: { data: { user: userProfile } } } : aweme,
                                    create_time: aweme.create_time,
                                    // 页脚二维码：视频指向播放直链；非视频作品用不带追踪参数的规范短链，
                                    // 免得二维码内容过长影响扫码识别（照搬上游 up douyin.ts:600-605）
                                    shareLink: isVideo
                                        ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${aweme.video.play_addr.uri}&ratio=1080p&line=0`
                                        : `https://www.douyin.com/${isArticle ? 'article' : 'note'}/${aweme.aweme_id}`,
                                    dynamicTypeLabel: isArticle ? '文章作品' : isVideo ? '视频作品' : this.is_slides ? '合辑作品' : '图文作品'
                                });
                                if (workInfoImg.length)
                                    await this.e.reply(workInfoImg);
                            }
                        }
                        : undefined;
                    /** 发送视频 */
                    const sendVideo = isVideo && hasDouyinContent('视频', 'video') && sendvideofile
                        ? async () => {
                            /*
                              媒体度量上报（本地新增，上游没有）。放在这条分支开头：走到这里就代表
                              这次解析确实要发一条视频出去，而下面无论走原视频还是烧弹幕的分支，
                              发出去的都是同一条媒体，只该记一次。
              
                              `video.duration` 是**毫秒**（同仓 ktr/template/douyin/video-work 的
                              formatDuration 就是先除 1000），所以用 fromMilliseconds；B站那边是秒、
                              走 fromSeconds。单位搞反会让抖音的时长大 1000 倍。
                            */
                            reportMedia({ kind: 'video', durationMs: fromMilliseconds(video?.duration) });
                            let danmakuList = [];
                            const sendOriginalVideo = async () => {
                                await downloadVideo(this.e, {
                                    video_url: g_video_url,
                                    title: {
                                        timestampTitle: `tmp_${Date.now()}.mp4`,
                                        originTitle: `${g_title}.mp4`
                                    },
                                    headers: {
                                        ...baseHeaders,
                                        Referer: g_video_url,
                                        Cookies: ''
                                    }
                                }, {
                                    message_id: this.e.message_id === undefined ? undefined : String(this.e.message_id)
                                });
                            };
                            if (this.forceBurnDanmaku || Config.douyin.burnDanmaku) {
                                try {
                                    const danmakuData = narrowApiResponse(await this.amagi.getDouyinData('弹幕数据', {
                                        aweme_id: data.aweme_id,
                                        duration: video?.duration || 0,
                                        typeMode: 'strict'
                                    }), '弹幕数据');
                                    danmakuList = danmakuData?.data?.danmaku_list || danmakuData?.danmaku_list || [];
                                    logger.debug(`[抖音] 获取到 ${danmakuList.length} 条弹幕`);
                                }
                                catch (error) {
                                    logger.warn('[抖音] 获取弹幕失败，将发送原视频', error);
                                }
                            }
                            if ((this.forceBurnDanmaku || Config.douyin.burnDanmaku) && danmakuList.length > 0) {
                                let downloadedVideoPath;
                                let resultPath;
                                try {
                                    const videoFile = await downloadFile(g_video_url, {
                                        title: `Douyin_V_tmp_${Date.now()}.mp4`,
                                        headers: {
                                            ...baseHeaders,
                                            Referer: 'https://www.douyin.com'
                                        }
                                    });
                                    downloadedVideoPath = videoFile.filepath;
                                    if (downloadedVideoPath) {
                                        resultPath = Common.tempDri.video + `Douyin_Danmaku_${Date.now()}.mp4`;
                                        const emojiList = await getEmojiList();
                                        const burnSucceeded = await burnDouyinDanmaku(downloadedVideoPath, danmakuList, resultPath, {
                                            danmakuArea: Config.douyin.danmakuArea,
                                            verticalMode: Config.douyin.verticalMode,
                                            videoCodec: Config.douyin.videoCodec,
                                            danmakuFontSize: Config.douyin.danmakuFontSize,
                                            danmakuOpacity: Config.douyin.danmakuOpacity,
                                            emojiList
                                        });
                                        if (burnSucceeded) {
                                            const size = await Common.getVideoFileSize(resultPath);
                                            await uploadFile(this.e, { filepath: resultPath, totalBytes: size, originTitle: g_title }, '');
                                            return;
                                        }
                                    }
                                }
                                catch (error) {
                                    logger.warn('[抖音] 弹幕视频处理失败，将发送原视频', error);
                                }
                                finally {
                                    if (downloadedVideoPath)
                                        await Common.removeFile(downloadedVideoPath, true);
                                }
                                if (resultPath)
                                    await Common.removeFile(resultPath, true);
                                await sendOriginalVideo();
                            }
                            else {
                                await sendOriginalVideo();
                            }
                        }
                        : undefined;
                    /**
                     * 评论图自己取数、自己渲染、自己发送，和海报/视频两条分支一起并发。
                     * 原来它排在 `await runMediaTasks(...)` 之后，视频上传多久评论图就得等多久，
                     * 而这三件事之间没有数据依赖。顺序不再保证，谁先好谁先发。
                     */
                    const sendComment = hasDouyinContent('评论图', 'comment')
                        ? async () => {
                            const list = await getEmojiList();
                            const commentsResult = await douyinComments(CommentsData, list);
                            if (!commentsResult.CommentsData.length) {
                                await this.e.reply('这个作品没有评论 ~');
                            }
                            else {
                                const aweme = VideoData.data.aweme_detail;
                                // 「大家都在搜」：只取评论区顶部那一组，其余场景（搜索页等）不是这张图要的
                                const suggest = [];
                                for (const item of aweme.suggest_words?.suggest_words ?? []) {
                                    if (item.scene !== 'comment_top_rec')
                                        continue;
                                    for (const word of item.words ?? []) {
                                        if (word.word)
                                            suggest.push(word.word);
                                    }
                                }
                                const img = await Render('douyin/comment', {
                                    Type: isArticle ? '文章' : isVideo ? '视频' : this.is_slides ? '合辑' : '图集',
                                    // 扁平数组，不是 { jsonArray } 包装：模板里 CommentsData.length / .map 直接读这个字段
                                    CommentsData: commentsResult.CommentsData,
                                    CommentLength: Config.douyin.realCommentCount
                                        ? aweme.statistics.comment_count ?? 0
                                        : commentsResult.CommentsData.length,
                                    share_url: this.is_mp4
                                        ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${aweme.video.play_addr.uri}&ratio=1080p&line=0`
                                        // 契约必填 string，而模板把它塞进二维码 `value={props.share_url}`；
                                        // 拿不到分享链接时退回作品页地址，别让二维码收到 undefined
                                        : aweme.share_url || `https://www.douyin.com/video/${aweme.aweme_id}`,
                                    VideoSize: mp4size,
                                    VideoFPS: FPS,
                                    ImageLength: imagenum,
                                    Region: aweme.region ?? '',
                                    suggestWrod: suggest,
                                    Resolution: isVideo && video
                                        ? `${video.bit_rate[0].play_addr.width} x ${video.bit_rate[0].play_addr.height}`
                                        : null,
                                    maxDepth: 6,
                                    Author: aweme.author.nickname ?? '',
                                    AuthorAvatar: aweme.author.avatar_thumb?.url_list[0] ?? '',
                                    // 线上 SSR 崩溃就是缺了这一个字段：VideoInfoHeader 直接读
                                    // props.Statistics.digg_count（Comment.tsx:147），拿 undefined 解属性当场抛。
                                    // 拿 HEAD 上的旧 payload 实测复现过，报错正是 reading 'digg_count'。
                                    Statistics: {
                                        digg_count: aweme.statistics.digg_count ?? 0,
                                        comment_count: aweme.statistics.comment_count ?? 0,
                                        share_count: aweme.statistics.share_count ?? 0,
                                        collect_count: aweme.statistics.collect_count ?? 0
                                    },
                                    CreateTime: aweme.create_time
                                });
                                // 评论区图片收集：把评论里出现过的图片/表情包合并转发出去
                                if (Config.douyin.commentImageCollection && commentsResult.image_url.length > 0) {
                                    const imageMessages = await Promise.all(commentsResult.image_url.map(async (url, index) => segment.image(await processImageUrl(url, aweme.desc || g_title || '抖音评论图片', index, {
                                        ...this.headers,
                                        Referer: 'https://www.douyin.com/'
                                    }))));
                                    await this.e.reply(await common.makeForwardMsg(this.e, imageMessages, '评论图片收集'));
                                }
                                await this.e.reply(img);
                            }
                        }
                        : undefined;
                    await runMediaTasks({
                        poster: sendVideoInfo,
                        video: sendVideo,
                        comment: sendComment
                    }, {
                        onTaskFailure: ({ task, error }) => {
                            const taskLabel = task === 'poster'
                                ? '视频信息海报/回复'
                                : task === 'video' ? '视频下载、弹幕烧录与发送' : '评论图渲染与发送';
                            logger.error(`[抖音] ${taskLabel}任务失败`, error);
                        }
                    });
                    return true;
                }
                case 'user_dynamic': {
                    const UserVideoListData = narrowApiResponse(await this.amagi.getDouyinData('用户主页视频列表数据', {
                        sec_uid: data.sec_uid,
                        typeMode: 'strict'
                    }), '用户主页视频列表数据');
                    const UserInfoData = narrowApiResponse(await this.amagi.getDouyinData('用户主页数据', {
                        sec_uid: data.sec_uid,
                        typeMode: 'strict'
                    }), '用户主页数据');
                    const awemeList = UserVideoListData?.data?.aweme_list || UserVideoListData?.aweme_list || [];
                    const user = UserInfoData.data.user;
                    const timeoutSeconds = 120;
                    const displayVideos = awemeList.slice(0, 16).map((aweme, index) => {
                        const isVideo = isDouyinVideo(aweme);
                        return {
                            aweme_id: aweme.aweme_id,
                            index: index + 1,
                            title: aweme.desc || aweme.item_title || '无标题',
                            cover: getDouyinWorkCoverUrl(aweme),
                            duration: aweme.video?.duration || 0,
                            // 原始秒级时间戳，不是格式化好的日期串：模板走
                            // formatDouyinPublishTime(video.create_time) 出「3 天前」这种相对时间，
                            // 它对非数字字符串是 `Number(...)` -> NaN -> 直接返回「发布时间未知」，
                            // 所以列表里每条作品的发布时间一直都是这四个字
                            create_time: Number(aweme.create_time) || 0,
                            is_top: aweme.is_top === 1,
                            is_video: isVideo,
                            // 统计数给原始数字：模板自己有 formatCount 做万/亿换算，
                            // 这边先用 Common.count 转成 '1.2万' 再传，等于把它的换算搞成字符串比较
                            statistics: {
                                like_count: Number(aweme.statistics?.digg_count) || 0,
                                comment_count: Number(aweme.statistics?.comment_count) || 0,
                                share_count: Number(aweme.statistics?.share_count) || 0,
                                collect_count: Number(aweme.statistics?.collect_count) || 0
                            },
                            music: aweme.music
                                ? { title: aweme.music.title || '', author: aweme.music.author || '' }
                                : undefined
                        };
                    });
                    const img = await Render('douyin/user_profile', {
                        user: {
                            head_image: user.cover_and_head_image_info?.profile_cover_list?.[0]?.cover_url?.url_list?.[0] || '',
                            nickname: user.nickname || '未知用户',
                            short_id: user.unique_id || user.short_id || '无法获取',
                            avatar: user.avatar_larger?.url_list?.[0] || user.avatar_thumb?.url_list?.[0] || '',
                            signature: user.signature || '这个用户很懒，还没有签名',
                            // 同上：模板里 formatCount(count: number) 自己做万/亿换算
                            follower_count: Number(user.follower_count) || 0,
                            following_count: Number(user.following_count) || 0,
                            total_favorited: Number(user.total_favorited) || 0,
                            verified: Boolean(user.custom_verify || user.enterprise_verify_reason),
                            ip_location: user.ip_location || ''
                        },
                        videos: displayVideos,
                        timeoutSeconds
                    });
                    img && await this.e.reply(img);
                    if (!displayVideos.length)
                        return true;
                    return {
                        type: 'douyin_user_selection',
                        timeoutSeconds,
                        videos: displayVideos.map(item => ({
                            aweme_id: item.aweme_id,
                            title: item.title,
                            index: item.index
                        }))
                    };
                }
                case 'music_work': {
                    const MusicData = narrowApiResponse(await this.amagi.getDouyinData('音乐数据', {
                        music_id: data.music_id,
                        typeMode: 'strict'
                    }), '音乐数据');
                    const sec_uid = MusicData.data.music_info.sec_uid;
                    const UserData = narrowApiResponse(await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' }), '用户主页数据');
                    // if (userdata.status_code === 2) {
                    //   const new_userdata = await getDouyinData('搜索数据', { query: data.music_info.author })
                    //   if (new_userdata.data[0].type === 4 && new_userdata.data[0].card_unique_name === 'user') {
                    //     userdata = { user: new_userdata.data[0].user_list[0].user_info }
                    //   }
                    //   const search_data = new_userdata
                    // }
                    if (!MusicData.data.music_info.play_url) {
                        await this.e.reply('解析错误！该音乐抖音未提供下载链接，无法下载', { reply: true });
                        return true;
                    }
                    img = await Render('douyin/musicinfo', {
                        image_url: MusicData.data.music_info.cover_hd.url_list[0],
                        desc: MusicData.data.music_info.title,
                        music_id: MusicData.data.music_info.id,
                        create_time: Time(0),
                        user_count: Common.count(MusicData.data.music_info.user_count),
                        avater_url: MusicData.data.music_info.avatar_large?.url_list[0] || UserData.data.user.avatar_larger.url_list[0],
                        // 契约里这三个是必填 number、下面两个是必填 string，
                        // 接口这几个字段都可选，模板又是直接印（`粉丝: {fans}`），漏出来就是 undefined
                        fans: Number(UserData.data.user.mplatform_followers_count || UserData.data.user.follower_count) || 0,
                        following_count: Number(UserData.data.user.following_count) || 0,
                        total_favorited: Number(UserData.data.user.total_favorited) || 0,
                        user_shortid: (UserData.data.user.unique_id || UserData.data.user.short_id) ?? '',
                        share_url: MusicData.data.music_info.play_url.uri ?? '',
                        username: MusicData.data.music_info?.original_musician_display_name || MusicData.data.music_info.owner_nickname === '' ? MusicData.data.music_info.author : MusicData.data.music_info.owner_nickname
                    });
                    if (!img)
                        return false;
                    await this.e.reply(this.mkMsg([
                        ...img,
                        `\n正在上传 ${MusicData.data.music_info.title}\n`,
                        `作曲: ${MusicData.data.music_info.original_musician_display_name || MusicData.data.music_info.owner_nickname === '' ? MusicData.data.music_info.author : MusicData.data.music_info.owner_nickname}\n`,
                        `music_id: ${MusicData.data.music_info.id}\n`,
                        `BGM_Id: ${data.music_id}`
                    ], [{ text: '音乐文件', link: MusicData.data.music_info.play_url.uri }]));
                    await this.e.reply(await UploadRecord(getUploadRecordEvent(this.e), MusicData.data.music_info.play_url.uri || '', 0, !Config.douyin.sendHDrecord));
                    return true;
                }
                case 'live_room_detail': {
                    const UserInfoData = narrowApiResponse(await this.amagi.getDouyinData('用户主页数据', {
                        sec_uid: data.sec_uid,
                        typeMode: 'strict'
                    }), '用户主页数据');
                    if (UserInfoData.data.user.live_status === 1) {
                        // 直播中
                        const liveData = narrowApiResponse(await this.amagi.getDouyinData('直播间信息数据', { sec_uid: UserInfoData.data.user.sec_uid, typeMode: 'strict' }), '直播间信息数据');
                        const { items: liveItems, partition } = getLivePayload(liveData);
                        const liveItem = liveItems[0];
                        if (!liveItem)
                            throw new Error('直播间信息数据返回格式异常');
                        const roomData = narrowApiResponse(JSON.parse(UserInfoData.data.user.room_data || '{}'), '直播间房间数据');
                        const img = await Render('douyin/live', buildDouyinLivePayload({
                            anchor: UserInfoData.data.user,
                            dynamicTYPE: '直播间信息',
                            liveItem,
                            partitionTitle: partition.partition?.title || '',
                            webRid: roomData.owner?.web_rid || liveItem.owner?.web_rid || ''
                        }));
                        await this.e.reply(img);
                    }
                    else {
                        await this.e.reply(`「${UserInfoData.data.user.nickname}」\n未开播，正在休息中~`);
                    }
                    return true;
                }
                default:
                    break;
            }
        }
        catch (error) {
            // 不能在这里把异常吃掉。四个调用点（tools.ts 的 305/345/383/492）全都跑在
            // wrapWithErrorHandler 里，没有一个在看这里的返回值，所以 `return false` 传不出任何信息，
            // 只是让统一错误处理层永远收不到东西——解析失败既不出错误卡片也不通知主人。
            // 上面那些刻意抛出的提示（比如「该作品已被删除或设置为私密」）因此对用户完全静默。
            //
            // 这条日志必须留在 try 内部：wrapWithErrorHandler 自己的 logger.error 在
            // logContext.run() 之外执行，那时 AsyncLocalStorage 的 store 已经没了，写不进日志上下文。
            // 只有这里的记录会被采集进错误卡片的日志区。传 error 对象而不是 `${error}`，堆栈才不会丢。
            logger.error(`[抖音] ${this.type} 解析失败`, error);
            throw error;
        }
    }
}
/**
 * 处理抖音视频数据，根据大小限制筛选合适的视频
 * @param {dyVideo[]} videos - 视频数组
 * @param {number} filelimit - 文件大小限制(MB)
 * @returns {dyVideo[]} 处理后的视频数组，只包含一个最合适的视频
 */
export const douyinProcessVideos = (videos, filelimit) => {
    const sizeLimitBytes = filelimit * 1024 * 1024; // 将 MB 转换为字节
    logger.debug(videos);
    // 过滤掉 format 为 'dash' 的视频，并且过滤出小于等于大小限制的视频
    const validVideos = videos.filter(video => video.format !== 'dash' && video.play_addr.data_size <= sizeLimitBytes);
    if (validVideos.length > 0) {
        // 如果有符合条件的视频，找到 data_size 最大的视频
        return [validVideos.reduce((maxVideo, currentVideo) => {
                return currentVideo.play_addr.data_size > maxVideo.play_addr.data_size ? currentVideo : maxVideo;
            })];
    }
    else {
        // 如果没有符合条件的视频，返回 data_size 最小的那个视频（排除 'dash' 格式）
        const allValidVideos = videos.filter(video => video.format !== 'dash');
        return [allValidVideos.reduce((minVideo, currentVideo) => {
                return currentVideo.play_addr.data_size < minVideo.play_addr.data_size ? currentVideo : minVideo;
            })];
    }
};
/**
 * 传递整数，返回x小时后的时间
 * @param {number} delay - 延迟的小时数
 * @returns {string} - 返回格式化后的时间字符串
 */
function Time(delay) {
    const currentDate = new Date();
    currentDate.setHours(currentDate.getHours() + delay);
    const year = currentDate.getFullYear().toString();
    const month = (currentDate.getMonth() + 1).toString();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}
/**
 * 处理抖音表情数据
 * @param {import('@ikenxuan/amagi').DyEmojiList} data 表情数据对象
 * @returns {Array<{name: string, url: string | undefined}>} 处理后的表情数组,包含name和url属性
 */
export const Emoji = (data) => {
    const ListArray = [];
    for (const i of data.emoji_list) {
        const display_name = i.display_name;
        const url = i.emoji_url.url_list[0];
        const Objject = {
            name: display_name,
            url
        };
        ListArray.push(Objject);
    }
    return ListArray;
};
