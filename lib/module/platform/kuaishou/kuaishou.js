import { Base, Config, Render, Networks, downloadVideo } from '../../../module/utils/index.js';
import { runMediaTasks, VIDEO_DOWNLOAD_TIMEOUT_MS } from '../../../module/utils/MediaTasks.js';
import { reportMedia } from '../../../module/utils/media-metrics.js';
import comments, {} from './comments.js';
/**
 * 探测视频体积用的请求头。
 *
 * 迁移前 `KuaishouData` 的构造函数会把 `Referer` / `Origin` / `Host` / `X-Requested-With`
 * 以及快手 ck **直接写进 `this.headers`** —— 而 `Base` 的 `this.headers` 就是
 * `Network/user-agent.ts` 里那个**模块级共享**的 `baseHeaders` 对象，赋值等于全局修改：
 * 一次快手解析之后，抖音 / B站 / 小红书的默认请求头里也带上了 `Host: www.kuaishou.com`
 * 和用户的快手 Cookie。
 *
 * 迁移到 amagi 后 cookie 与业务请求头都由 amagi 自己组装（`getKuaishouDefaultConfig`），
 * 那段污染代码随 `getdata.ts` 的重写一起删掉了。但**下面这次 HEAD 探测不走 amagi**，
 * 它是本仓库自己用 `Networks` 发的；而它之前恰好是靠那份污染拿到 `Referer` 的。
 * 所以在这里显式补上，免得把污染删掉的同时静默丢掉防盗链头。
 *
 * 只补 `Referer` / `Origin`：`Host` 由 axios 按 URL 自己算（写死会指错 CDN 域名），
 * Cookie 对取 `content-length` 没有必要，也不该把 ck 发给视频 CDN。
 */
const kuaishouMediaHeaders = (base) => ({
    ...base,
    Referer: 'https://www.kuaishou.com/',
    Origin: 'https://www.kuaishou.com'
});
export default class KuaiShou extends Base {
    constructor(e = {}, _Iddata) {
        super();
        this.e = e;
    }
    async Action(data) {
        const videoDetail = data.VideoData?.data?.data?.visionVideoDetail || data.VideoData?.data?.visionVideoDetail;
        const commentsData = data.CommentsData?.data || data.CommentsData || data.CommentData;
        const emojiList = data.EmojiData?.data?.data?.visionBaseEmoticons?.iconUrls || data.EmojiData?.data?.visionBaseEmoticons?.iconUrls || {};
        if (videoDetail?.status !== 1) {
            await this.e.reply('不支持解析的视频');
            return true;
        }
        ;
        (Config.app.parseTip || Config.kuaishou.kuaishoutip) && await this.e.reply('检测到快手链接，开始解析');
        /*
          两条独立支线的共享前置，必须留在 fan-out 之前：
          - `video_url` 两条都要用（评论卡的 share_url / HEAD 探测、以及视频下载本身）
          - `transformedData` 是 comments() 渲染表情要的表，只该转一次
          上面 `status !== 1` 的早退和解析提示同理 —— 那两句要在任何支线启动前跑完。
        */
        const video_url = videoDetail.photo.photoUrl;
        const transformedData = Object.entries(emojiList).map(([name, path]) => {
            return { name, url: `https:${path}` };
        });
        /**
         * 评论卡片支线：自己处理评论数据、自己探体积、自己渲染、自己发送。
         *
         * 这三步**必须留在同一条支线里按序跑**：`VideoSize` 就是 `getHeaders()` 探回来的
         * `content-length`，把 HEAD 探测拆成另一条并发支线会让 Render 拿到还没探到的体积。
         * 能和视频下载并发的是「整条评论卡」，不是它内部的这几步。
         */
        const sendComment = async () => {
            const CommentsData = await comments(commentsData, transformedData);
            const videoheaders = await new Networks({ url: video_url, headers: kuaishouMediaHeaders(this.headers) }).getHeaders();
            const Size = videoheaders['content-length'] ? parseInt(videoheaders['content-length'], 10) : 0;
            const videoSizeInMB = (Size / (1024 * 1024)).toFixed(2);
            const img = await Render('kuaishou/comment', {
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
            });
            await this.e.reply(img);
        };
        /** 视频下载支线：只依赖 `video_url`，不等评论卡渲染完 */
        const sendVideo = async () => {
            /*
              媒体度量上报（和 douyin/bilibili 的视频分支同一位置：分支开头，走到这里
              就代表这次解析确实要发一条视频出去）。
      
              不带 `durationMs`：快手当前的解析路径上没有时长字段（`visionVideoDetail.photo`
              里本仓只取了 photoUrl/caption/viewCount/likeCount），media-metrics 对此的约定是
              留 undefined，写库端据此只累加条数、不动时长分母。裸给 0 会污染平均时长。
            */
            reportMedia({ kind: 'video' });
            await downloadVideo(this.e, {
                video_url: video_url,
                title: {
                    timestampTitle: `tmp_${Date.now()}.mp4`,
                    originTitle: `${videoDetail.photo.caption || '快手作品'}.mp4`
                }
            });
        };
        await runMediaTasks({
            video: sendVideo,
            comment: sendComment
        }, {
            /*
              只放宽视频下载这一条。评论卡那条是「处理评论数据 + 一次 HEAD 探测 + 一次渲染」，
              60s 的默认兜底本来就够，跟着放宽只会让卡死的渲染多挂 9 分钟。
            */
            taskTimeoutMs: { video: VIDEO_DOWNLOAD_TIMEOUT_MS },
            onTaskFailure: ({ task, error }) => {
                const taskLabel = task === 'video' ? '视频下载与发送' : '评论图渲染与发送';
                logger.error(`[快手] ${taskLabel}任务失败`, error);
            }
        });
        return true;
    }
}
