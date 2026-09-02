import { Base, downloadVideo } from '../../../module/utils/Base.js';
import { baseHeaders } from '../../../module/utils/Network/index.js';
import { Render } from '../../../module/utils/Render.js';
import Config from '../../../module/utils/Config.js';
import Common from '../../../module/utils/Common.js';
import { processImageUrl } from '../../../module/utils/ImageHelper.js';
import common from '../../../runtime/host/common.js';
import { buildLivePhotoMessagesBatch, buildLivePhotoTipMessage, pickXiaohongshuImageUrl } from './livePhoto.js';
import { buildNoteStatistics, buildRenderComments, buildXiaohongshuEmojiList, buildXiaohongshuRichText, formatTime, getCommentLimit } from './comments.js';
import { buildAmagiRequestConfig, xiaohongshuFetcher } from '../../../module/utils/amagiClient.js';
import { buildXiaohongshuShareUrl } from './link.js';
import { getErrorMessage } from '../../../module/utils/error-message.js';
import { livePhotoBatchTimeoutMs, runMediaTasks, VIDEO_DOWNLOAD_TIMEOUT_MS } from '../../../module/utils/MediaTasks.js';
import { reportMedia } from '../../../module/utils/media-metrics.js';
/**
 * `onTaskFailure` 的日志文案。用 `Record<MediaTaskName, string>` 而不是四层三元：
 * 小红书四条支线把 union 用满了，Record 能让漏掉一条直接编译不过。
 */
const MEDIA_TASK_LABELS = {
    poster: '笔记信息卡渲染与发送',
    video: '视频下载与发送',
    image: '图集/实况图发送',
    comment: '评论图渲染与发送'
};
const buildShareUrl = (data) => buildXiaohongshuShareUrl(data.note_id, data.xsec_token);
const getNoteCard = (noteResponse) => noteResponse?.data?.data?.items?.[0]?.note_card;
const normalizeSendContent = () => Array.isArray(Config.xiaohongshu.sendContent) ? Config.xiaohongshu.sendContent : [];
/**
 * 按配置数量分页获取小红书评论，避免只取首屏导致评论数量不足。
 * fetchComments 参数用于隔离 API wrapper，也便于在不触碰真实网络的情况下验证分页仲裁。
 */
export const fetchConfiguredNoteComments = async (data, fetchComments = async (options) => await xiaohongshuFetcher.fetchNoteComments(options, Config.cookies.xiaohongshu, buildAmagiRequestConfig())) => {
    const targetCount = getCommentLimit();
    const firstPage = await fetchComments({
        typeMode: 'strict',
        note_id: data.note_id,
        xsec_token: data.xsec_token || ''
    });
    const firstPageData = firstPage.data?.data || {};
    const comments = [...(firstPageData.comments || [])];
    let cursor = firstPageData.cursor;
    let hasMore = firstPageData.has_more;
    const seenCursors = new Set();
    while (comments.length < targetCount && hasMore && cursor && !seenCursors.has(cursor)) {
        seenCursors.add(cursor);
        const nextPage = await fetchComments({
            typeMode: 'strict',
            note_id: data.note_id,
            cursor,
            xsec_token: data.xsec_token || ''
        });
        const nextPageData = nextPage.data?.data || {};
        comments.push(...(nextPageData.comments || []));
        cursor = nextPageData.cursor;
        hasMore = nextPageData.has_more;
    }
    return {
        ...firstPage,
        data: {
            ...firstPage.data,
            data: {
                ...firstPageData,
                comments,
                cursor,
                has_more: hasMore
            }
        }
    };
};
const collectVideoStreams = (streamData) => {
    const codecPriority = ['h265', 'h264', 'av1', 'h266'];
    const streams = [];
    for (const codec of codecPriority) {
        const codecStreams = streamData?.[codec];
        if (Array.isArray(codecStreams))
            streams.push(...codecStreams);
    }
    return streams;
};
const getQualityLevel = (stream) => {
    const pixels = (stream.width || 0) * (stream.height || 0);
    if (pixels >= 3840 * 2160)
        return '4k';
    if (pixels >= 2560 * 1440)
        return '2k';
    if (pixels >= 1920 * 1080)
        return '1080p';
    if (pixels >= 1280 * 720)
        return '720p';
    return '540p';
};
export const selectVideoStream = (streamData) => {
    const streams = collectVideoStreams(streamData);
    if (!streams.length)
        return null;
    const quality = Config.xiaohongshu.videoQuality || '4k';
    const qualityPriority = ['4k', '2k', '1080p', '720p', '540p'];
    const sorted = streams.sort((a, b) => (b.size || 0) - (a.size || 0));
    if (quality === 'adapt') {
        const limit = (Config.xiaohongshu.maxAutoVideoSize || 50) * 1024 * 1024;
        // adapt 的语义是「体积上限内挑最好的画质」，所以画质档是第一排序键、体积才是第二：
        // 先按 4k→540p 找出「有流能塞进上限」的最高档，再在该档里取体积最大的（同分辨率下码率更高）。
        // 只按体积降序找第一个不超限的会在「高清档反而更小」时选错 —— 跨编码很常见，
        // 例如 4k h265 40MB 与 1080p h264 45MB 同在 50MB 限内，纯比体积会退回 1080p。
        for (const item of qualityPriority) {
            const stream = sorted.find(stream => getQualityLevel(stream) === item && (stream.size || 0) <= limit);
            if (stream)
                return stream;
        }
        // 没有任何档塞得进上限时退回体积最小的，至少让它有机会发出去
        return sorted.at(-1);
    }
    const targetIndex = qualityPriority.indexOf(quality);
    const fallbackOrder = targetIndex >= 0
        ? [...qualityPriority.slice(targetIndex), ...qualityPriority.slice(0, targetIndex).reverse()]
        : qualityPriority;
    for (const item of fallbackOrder) {
        const stream = sorted.find(stream => getQualityLevel(stream) === item);
        if (stream)
            return stream;
    }
    return sorted[0];
};
export class Xiaohongshu extends Base {
    type;
    constructor(e, iddata) {
        super(e);
        this.e = e;
        this.type = iddata?.type;
    }
    async XiaohongshuHandler(data) {
        if (!Config.cookies.xiaohongshu) {
            await this.e.reply('我还没有小红书 Cookies，暂时无法解析');
            return true;
        }
        // 与本仓库其它平台（bilibili/douyin/kuaishou）保持一致：开了解析提示就先回一句，
        // 别让用户以为没反应。小红书原来漏了这句。
        if (Config.app.parseTip) {
            await this.e.reply('检测到小红书链接，开始解析');
        }
        const sendContent = normalizeSendContent();
        const noteData = await xiaohongshuFetcher.fetchNoteDetail({
            typeMode: 'strict',
            note_id: data.note_id,
            xsec_token: data.xsec_token || ''
        }, Config.cookies.xiaohongshu, buildAmagiRequestConfig());
        const card = getNoteCard(noteData);
        if (!card) {
            throw new Error(noteData?.success === false
                ? `小红书笔记获取失败: ${noteData.message || '未知错误'}`
                : '小红书笔记数据为空');
        }
        let emojiData = [];
        if (sendContent.includes('info') || sendContent.includes('comment')) {
            try {
                const emojiList = await xiaohongshuFetcher.fetchEmojiList({ typeMode: 'strict' }, Config.cookies.xiaohongshu, buildAmagiRequestConfig());
                emojiData = buildXiaohongshuEmojiList(emojiList);
            }
            catch (error) {
                logger.debug(`[小红书] 获取表情列表失败，使用纯文本渲染: ${getErrorMessage(error)}`);
            }
        }
        /**
         * image 与 video 两条支线的互斥判据，只在这里读一次。
         *
         * 有 `video` 字段就只跑 video 支线，没有就只跑 image 支线 —— 视频笔记不该跑
         * 图片循环，图文笔记也没有视频可下。所以下面虽然挂了四条支线，一次解析里
         * 实际同时在跑的最多三条。
         */
        const noteVideo = card.video;
        const sendNoteInfo = sendContent.includes('info')
            ? async () => {
                const noteInfoImg = await Render('xiaohongshu/noteInfo', {
                    title: card.title || '无标题',
                    desc: buildXiaohongshuRichText(card.desc, emojiData, [], { stripTopicMarker: true }),
                    statistics: buildNoteStatistics(card.interact_info),
                    note_id: card.note_id || data.note_id,
                    author: {
                        avatar: card.user?.avatar || card.user?.image || '',
                        nickname: card.user?.nickname || card.user?.nick_name || '未知用户',
                        user_id: card.user?.user_id || card.user?.id || ''
                    },
                    image_url: pickXiaohongshuImageUrl(card.image_list?.[0]) || card.video?.image?.url_default || card.video?.cover?.url_default || '',
                    time: formatTime(card.time),
                    ip_location: card.ip_location || '',
                    share_url: buildShareUrl(data),
                    image_list: card.video
                        ? [card.video.image?.url_default || card.video.cover?.url_default || pickXiaohongshuImageUrl(card.image_list?.[0]) || ''].filter(Boolean)
                        : (card.image_list || []).map(item => pickXiaohongshuImageUrl(item)).filter((item) => Boolean(item)),
                    is_video: Boolean(card.video)
                });
                await this.e.reply(noteInfoImg);
            }
            : undefined;
        /**
         * 评论图支线：自己分页取数、自己渲染、自己发送。
         *
         * 原来它排在笔记信息卡之后，信息卡渲染多久评论图就得等多久 —— 而两者之间只有
         * `emojiData` 这个已经在上面取好的共享输入，没有别的数据依赖。
         * 「这个笔记没有评论」那句用户可见的反馈留在支线内部，别跟着挪走。
         */
        const sendComment = sendContent.includes('comment')
            ? async () => {
                const commentData = await fetchConfiguredNoteComments(data);
                const comments = commentData?.data?.data?.comments || [];
                if (!comments.length) {
                    await this.e.reply('这个笔记没有评论 ~');
                    return;
                }
                // 分页取数为了凑够 numcomment 条会多抓一整页，comments 里往往比实际渲染的多。
                // CommentLength 是模板头部那句「评论数量：N条」，要跟下面真正渲染出来的卡片数一致，
                // 所以取切片后的长度，而不是 comments.length 这个取数过程的中间量。
                const renderComments = buildRenderComments(comments, emojiData, card.note_id || data.note_id);
                const commentListImg = await Render('xiaohongshu/comment', {
                    Type: card.video ? '视频' : '图文',
                    CommentsData: renderComments,
                    CommentLength: renderComments.length,
                    ImageLength: card.image_list?.length || 0,
                    share_url: buildShareUrl(data)
                });
                await this.e.reply(commentListImg);
            }
            : undefined;
        /**
         * 图集/实况图支线：自己下载、自己合并转发、自己清理临时文件。
         *
         * `!noteVideo` 这个前置条件不能丢：视频笔记不该跑图片循环。
         * `finally` 里的清理留在支线内部 —— 它只清这条支线自己生成的那批临时文件。
         */
        const sendImages = !noteVideo && sendContent.includes('image')
            ? async () => {
                const imageMessages = [];
                const tempFiles = [];
                let hasGeneratedLivePhoto = false;
                const images = card.image_list || [];
                // 先把整批的下载在窗口里滚起来（ffmpeg 仍然按序串行），再按下标消费。
                // 逐位对齐是关键：imageMessages 的顺序就是转发消息里图片的顺序。
                const livePhotoBatch = await buildLivePhotoMessagesBatch(images);
                tempFiles.push(...livePhotoBatch.tempFiles);
                hasGeneratedLivePhoto = livePhotoBatch.generatedLivePhoto;
                for (const [index, item] of images.entries()) {
                    const livePhoto = livePhotoBatch.results[index];
                    if (livePhoto !== undefined && livePhoto.messages.length > 0) {
                        imageMessages.push(...livePhoto.messages);
                        continue;
                    }
                    const imageUrl = await processImageUrl(pickXiaohongshuImageUrl(item) ?? '', card.title || '小红书图片', index, {
                        Referer: 'https://www.xiaohongshu.com',
                        Cookie: Config.cookies.xiaohongshu
                    });
                    if (imageUrl)
                        imageMessages.push(segment.image(imageUrl));
                }
                if (hasGeneratedLivePhoto)
                    imageMessages.push(await buildLivePhotoTipMessage());
                try {
                    if (imageMessages.length === 1) {
                        await this.e.reply(imageMessages[0]);
                    }
                    else if (imageMessages.length > 1) {
                        await this.e.reply(await common.makeForwardMsg(this.e, imageMessages, '小红书图集解析结果'));
                    }
                }
                finally {
                    for (const item of tempFiles) {
                        if (item?.filepath)
                            await Common.removeFile(item.filepath, true);
                    }
                }
            }
            : undefined;
        /**
         * 视频下载支线：只依赖 `noteVideo`，不等两张卡片渲染完。
         *
         * 「未找到可用的视频地址」原来是 `return true` 提前结束整个 handler；挪进支线后
         * 变成这条支线自己 return —— 那句用户可见的反馈照发，handler 仍然返回 true，
         * 另外几条支线也不该被它掐断（它们跟视频地址没关系）。
         */
        const sendNoteVideo = noteVideo && sendContent.includes('video')
            ? async () => {
                const stream = selectVideoStream(noteVideo.media?.stream);
                /*
                  两条地址都要带下去，而不是只把第二条当「第一条字段缺失时的替补」。
        
                  `stream.master_url` 和 `url_default` 是同一个作品的两条**不同**的下载地址
                  （前者出自选中那一路码流，后者是笔记自带的默认播放地址），原来的 `||` 只在
                  前者**字段不存在**时才会用到后者 —— 可实际故障是字段拿得到、地址却回 403 / 404，
                  那种情况下 `||` 一步也帮不上，整次解析就跟着那一条地址一起失败。
        
                  交给下载层当候选清单，坏地址才会走到「换一条重试」那条路上。
                  `resource` 是地址簿的键，带上它这批地址还能在 5 分钟内被同一作品的重试复用。
                */
                const videoCandidates = [stream?.master_url, noteVideo.url_default].filter((url) => Boolean(url));
                const videoUrl = videoCandidates[0];
                if (!videoUrl) {
                    await this.e.reply('未找到可用的视频地址');
                    return;
                }
                const noteId = card.note_id || data.note_id;
                /*
                  媒体度量上报（和 douyin / bilibili 的视频分支同一位置：真要发视频了才记一条），
                  补齐小红书的统计口径 —— 在这之前它开着度量作用域却从不上报，媒体数恒为 0。
        
                  不带 `durationMs`：小红书当前的解析路径上没有时长字段（选流只看 width/height/size），
                  media-metrics 对此的约定就是留 undefined，写库端只累加条数、不动时长分母。
                  `bytes` 用选中那条流自报的 size，拿不到就是 undefined（上报处自己会归一）。
                */
                reportMedia({ kind: 'video', bytes: stream?.size });
                await downloadVideo(this.e, {
                    video_url: videoUrl,
                    title: {
                        timestampTitle: `tmp_${Date.now()}.mp4`,
                        originTitle: `${card.title || '小红书视频'}.mp4`
                    },
                    headers: {
                        ...baseHeaders,
                        Referer: 'https://www.xiaohongshu.com',
                        Cookie: Config.cookies.xiaohongshu
                    },
                    candidates: videoCandidates,
                    resource: noteId ? `xhs:${noteId}:video` : undefined
                });
            }
            : undefined;
        /*
          四条支线并发跑：谁先好谁先发，顺序不再保证（笔记正文卡可能比评论卡晚到），
          和 douyin / bilibili 一致。共享前置（笔记取数、`emojiData` 表情表、`noteVideo`）
          都在 fan-out 之前跑完，所以四条支线里没有任何一条会再去取一次表情列表。
          image / video 靠 `noteVideo` 互斥，实际同时在跑的最多三条。
        */
        await runMediaTasks({
            poster: sendNoteInfo,
            video: sendNoteVideo,
            image: sendImages,
            comment: sendComment
        }, {
            /*
              只放宽两条重支线，两张卡片继续吃 60s 的默认兜底 —— 渲染卡死不该多挂 9 分钟。
      
              image 按图数算（`livePhotoBatchTimeoutMs`）：整批实况图的工作量线性于图数，
              而这里能拿到的图数就是 `card.image_list` 的长度。视频笔记走不到 image 支线，
              此时这个值算出来也没人用，留着比加个分支判断干净。
            */
            taskTimeoutMs: {
                image: livePhotoBatchTimeoutMs(card.image_list?.length ?? 0),
                video: VIDEO_DOWNLOAD_TIMEOUT_MS
            },
            onTaskFailure: ({ task, error }) => {
                logger.error(`[小红书] ${MEDIA_TASK_LABELS[task]}任务失败`, error);
            }
        });
        return true;
    }
}
