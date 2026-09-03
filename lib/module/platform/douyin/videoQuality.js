import { parseJsonSafely } from './workType.js';
/** 档位优先级，从高到低。480p 垫在最低档（480 < 540），是回落链的终点。 */
const QUALITY_PRIORITY = ['4k', '2k', '1080p', '720p', '540p', '480p'];
/**
 * 档位 → 卡片上展示的标签，沿用抖音 Web 端播放器的说法。
 *
 * 比 `QUALITY_PRIORITY` 多担一层责任：这里是给人看的，所以 480p 也要有词条 ——
 * 识别域认得 480p 却没有标签，纯 480p 作品的卡片会印出空清晰度。
 */
const QUALITY_LABEL = {
    '4k': '超清4K',
    '2k': '超清2K',
    '1080p': '高清1080P',
    '720p': '高清720P',
    '540p': '标清540P',
    '480p': '标清480P'
};
/**
 * `video_extra.definition` → 内部档位名。
 *
 * 抖音把 2K 记作 `1440p`，而配置项 `videoQuality` 用的是 `2k`，这张表是两套词表唯一的翻译点，
 * 配置域不需要跟着上游改。
 */
const DEFINITION_TO_LEVEL = {
    '4k': '4k',
    '2k': '2k',
    '1440p': '2k',
    '1080p': '1080p',
    '720p': '720p',
    '540p': '540p',
    '480p': '480p'
};
/**
 * 拼一条 `aweme.snssdk.com` 的播放地址，作为签名直链之外的**兜底**。
 *
 * 只在 `url_list` 为空、或者里面每一条都下载失败时才该被用到，
 * 绝不能顶掉 `url_list[0]`：那条是带签名的 CDN 直链，
 * `pickDouyinPlayUrl` 的注释里记了为什么它必须排在最前。
 *
 * **这条地址永远排在候选清单的最末尾。** 它不是「更差的画质」，而是更慢：
 * 实测这个域名的冷启动握手要多花 ~5.7s（同一作品、同一网络下与签名直链对比），
 * 因为它要先做一次抖音侧的负载均衡再 302 到真正的 CDN。
 * 谁想把它挪前面「省一次 url_list 解析」，先把那 5.7s 补回来。
 *
 * 顺带修掉上游的一个拼串 bug：上游写的是 `?video_id=${uri}&&file_id=${fileId}`，
 * 两个 `&` 会在 query 里夹出一个空参数。这里改用 `URLSearchParams`，
 * 分隔符和转义都交给它，`uri` 里出现特殊字符也不会拼坏。
 * @param playAddr - `bit_rate[]` 项或 `images[].video.play_addr_h264` 的 play_addr 对象
 * @returns 完整播放地址；`uri` 缺失时返回空串，由调用方决定怎么兜
 */
export const buildDouyinPlayUrl = (playAddr) => {
    const uri = playAddr?.uri;
    if (!uri)
        return '';
    const params = new URLSearchParams({ video_id: uri });
    // url_list[2] 是 www.douyin.com 的包装地址，`file_id` 只在它的 query 里，
    // 抖音靠这个参数把请求路由到与签名直链同一份文件。取不到就只带 video_id，
    // 那样也能播，只是可能落到另一路转码结果。
    const fileId = extractFileId(playAddr?.url_list);
    if (fileId)
        params.set('file_id', fileId);
    return `https://aweme.snssdk.com/aweme/v1/play/?${params.toString()}`;
};
/**
 * 从包装地址的 query 里取 `file_id`。
 *
 * 不写死下标 2：实测 `url_list` 的长度在 2~3 之间浮动，写死会在只有两条时漏掉。
 * @param urlList - `play_addr.url_list`
 * @returns file_id，取不到时 undefined
 */
const extractFileId = (urlList) => {
    for (const url of urlList ?? []) {
        try {
            const fileId = new URL(url).searchParams.get('file_id');
            if (fileId)
                return fileId;
        }
        catch {
            // 不是合法 URL 就跳过，拼不出 file_id 不是致命错误
        }
    }
    return undefined;
};
/**
 * 判定单条视频源的清晰度档位。
 *
 * `video_extra.definition` 是主判据：十一个作品 120 条 mp4 档实测 100% 有值、100% 与 ffprobe
 * 吻合。不能拿 `play_addr.width × height` 反推 —— 抖音允许非标准比例，实测见过 `1900×3378`
 * 的最高档，按像素匹配落不到任何标准档，而 `definition` 直接给 `4k`。
 * @param video - 视频源对象
 * @returns 档位名，认不出时返回 undefined
 */
export const getDouyinQualityLevel = (video) => {
    const definition = parseJsonSafely(video.video_extra).definition;
    const level = definition ? DEFINITION_TO_LEVEL[definition] : undefined;
    return level ?? guessLevelFromGearName(video.gear_name ?? '');
};
/**
 * 从 `gear_name` 猜档位，只在 `video_extra.definition` 缺失时兜底。
 *
 * 实测中 `definition` 一次都没缺过，所以这条路没被走过 —— 但兜底存在的意义就是应对字段消失。
 * 认不出来返回 undefined 交给调用方，不默认落到 540p 污染分档。
 * @param gearName - 视频源的 gear_name
 * @returns 档位名，认不出时返回 undefined
 */
const guessLevelFromGearName = (gearName) => {
    // `_4_` 的语义是「该作品的最高档」。上游写的 `includes('lowest_4')` 会漏掉
    // `ame_bvc1_vip_direct_vs_r1_adapt_lower_4_1` —— 实测样本里它恰好是码率最高的那条 4K，
    // 漏判等于把最高清的源丢掉。`(?:^|_)4_` 不会误吃 `1440`：那两个 `4` 前面是 `1` 和 `4`。
    if (/(?:^|_)4_\d+$/.test(gearName))
        return '4k';
    if (gearName.includes('1440'))
        return '2k';
    if (gearName.includes('1080'))
        return '1080p';
    if (gearName.includes('720'))
        return '720p';
    if (gearName.includes('540'))
        return '540p';
    // 480 排在 540 之后，跟着档位从高到低的顺序写。实测样本里 `normal_480_0` 与
    // `comet_bvc1_r3_adapt_lowest_480_1` 走的都是 definition 主判据，这条只在 video_extra 消失时兜底。
    if (gearName.includes('480'))
        return '480p';
    return undefined;
};
/**
 * 把选中的源格式化成卡片上展示的清晰度标签。
 *
 * 传入的必须是 {@link douyinProcessVideos} 选中的那一路源 —— 卡片写的清晰度要和实际下载的
 * 那一路一致，否则会出现「卡片写 4K、实际下载 720p」的错位。
 * @param video - 选中的视频源
 * @returns 形如 `超清4K`；档位认不出时返回空串，交给调用方决定要不要展示
 */
export const formatDouyinQualityLabel = (video) => {
    if (!video)
        return '';
    const level = getDouyinQualityLevel(video);
    return level ? QUALITY_LABEL[level] : '';
};
/**
 * 把选中的源整理成卡片上的分辨率信息。
 * @param video - {@link douyinProcessVideos} 选中的那一路源
 * @returns 三个字段齐了才返回对象；缺任何一个就返回 undefined，让卡片整块不渲染
 */
export const buildDouyinResolutionInfo = (video) => {
    const { width, height } = video?.play_addr ?? {};
    // 宽高缺一个就整块不给：卡片第二行印的是「width × height px」，
    // 少一半会印成「1080 × undefined px」，比不印更难看
    if (!width || !height)
        return undefined;
    // 档位认不出时同样整块不给：第一行是档位名、第二行才是像素，
    // 只留像素会印出一行空标签顶在上面，比不印更像渲染坏了
    const name = formatDouyinQualityLabel(video);
    if (!name)
        return undefined;
    return { width, height, name };
};
/**
 * 这条源本身是不是 HDR。
 *
 * 判据是逐条的，不是整个作品的：真 HDR 作品里 HDR 档与一条同分辨率的 SDR 档成对出现
 * （同 `quality_type`，只差 profile 和 pix_fmt），所以不能用顶层 `is_source_HDR`，
 * 那会把 SDR 孪生也标成 HDR。
 *
 * 只有卡片用它 —— 挑源不再排除 HDR，所以选中的源是不是 HDR 由体积和档位决定，
 * 卡片必须照着**选中那一路**标，不能标作品有没有 HDR 档。
 * @param video - 视频源对象
 * @returns 是否为 HDR 源
 */
export const isDouyinHdrStream = (video) => {
    if (/hdr/i.test(video.gear_name ?? ''))
        return true;
    if (video.HDR_type && video.HDR_type !== '0')
        return true;
    return Number(video.HDR_bit) > 8;
};
/**
 * 同档位内的取源顺序：体积从大到小（同分辨率下体积大 = 码率高）。
 * @param a - 视频源 A
 * @param b - 视频源 B
 * @returns 排序比较值
 */
const bySizeDesc = (a, b) => b.play_addr.data_size - a.play_addr.data_size;
/**
 * @param videos - 视频源数组
 * @returns 档位 → 该档位下的视频源
 */
const groupByQualityLevel = (videos) => {
    const grouped = new Map();
    for (const video of videos) {
        const level = getDouyinQualityLevel(video);
        if (!level) {
            logger.debug(`[douyin] 认不出清晰度档位，跳过该源：gear_name=${video.gear_name}`);
            continue;
        }
        const bucket = grouped.get(level);
        if (bucket)
            bucket.push(video);
        else
            grouped.set(level, [video]);
    }
    grouped.forEach(bucket => bucket.sort(bySizeDesc));
    return grouped;
};
/**
 * 固定档位模式下的回落顺序：先往低档找，再往高档找。
 * @param target - 目标档位
 * @returns 从目标档位开始的完整尝试顺序
 */
const buildFallbackOrder = (target) => {
    const index = QUALITY_PRIORITY.indexOf(target);
    if (index < 0)
        return QUALITY_PRIORITY;
    return [...QUALITY_PRIORITY.slice(index), ...QUALITY_PRIORITY.slice(0, index).reverse()];
};
/**
 * 从 `bit_rate` 里挑出唯一一路可下载的源。
 *
 * **档位是第一排序键、体积是第二。** 只按体积降序取「不超上限的最大那条」会跨档选错：
 * H.265 的高分辨率条目常比 H.264 的低分辨率条目更小，实测样本里 500MB 预算下 4K 只要
 * 491.9MB，却会被 497.6MB 的 2K 抢走。小红书那条路径（`xiaohongshu.ts` 的
 * `selectVideoStream`）早就是这么排的，抖音这边一直没跟上。
 *
 * HDR 档不再排除。QQ 现在认得 HDR，不会再把 HLG 片源渲染成偏灰发白，原先把它筛掉的
 * 理由已经不成立。它的体积恒为该作品的全局最大（四个真 HDR 样本 4/4），所以在自己档位里
 * 排第一，装得下就会被选中；装不下则顺着同档的 SDR 孪生往下走，不用降档。
 * @param videos - `aweme_detail.video.bit_rate` 数组
 * @param options - 挑源参数
 * @returns 长度为 1 的数组，元素为选中的视频源
 */
export const douyinProcessVideos = (videos, options = {}) => {
    // dash 是 App 端流媒体专用，下载和 Web 播放都只认 mp4
    const candidates = videos.filter(video => video.format !== 'dash');
    if (candidates.length === 0) {
        // 只剩 dash（或压根没给源）时没得挑，回退第一条让调用方自己判。
        // 旧实现在这里走 reduce 会抛「Reduce of empty array」，报错信息看不出是接口没给源。
        const fallback = videos[0];
        if (!fallback)
            throw new Error('接口没有返回任何视频源');
        return [fallback];
    }
    const quality = options.videoQuality || 'adapt';
    const filelimit = options.filelimit;
    /*
      两个上限**同时**生效，谁更严谁说话：`filelimit` 是上传通道的硬闸门
      （`Base.ts` 里超了就 `return false` 并回「已取消上传」），`maxAutoVideoSize`
      只是画质偏好。所以不能像原来那样在 adapt 模式下用 `maxAutoVideoSize || filelimit`
      ——面板上前者能填到 9999、后者最低能填 5，一旦用户把前者调得比后者大，
      挑源会选中一条注定被上传环节拒掉的流，而同一作品里更小的档本来发得出去。
      固定档位模式只受 filelimit 约束（`maxAutoVideoSize` 按设计仅 adapt 生效）。
  
      0 / undefined 都表示「这一路不设限」，靠 filter 滤掉后再取 min，
      两个都没给就是 Infinity。
    */
    const limits = quality === 'adapt'
        ? [options.maxAutoVideoSize, filelimit]
        : [filelimit];
    const effective = limits.filter((value) => typeof value === 'number' && value > 0);
    const sizeLimitBytes = effective.length > 0 ? Math.min(...effective) * 1024 * 1024 : Infinity;
    const grouped = groupByQualityLevel(candidates);
    const order = quality === 'adapt' ? QUALITY_PRIORITY : buildFallbackOrder(quality);
    for (const level of order) {
        // 组内已按体积降序，第一条不超限的就是该档位里码率最高的可用源
        const picked = grouped.get(level)?.find(video => video.play_addr.data_size <= sizeLimitBytes);
        if (picked) {
            logger.debug(`[douyin] 选中 ${level}，体积 ${(picked.play_addr.data_size / (1024 * 1024)).toFixed(2)}MB`);
            return [picked];
        }
    }
    // 没有任何档塞得进上限（或所有源的档位都认不出），退回体积最小的那条，至少让它有机会发出去
    const smallest = candidates.reduce((min, video) => video.play_addr.data_size < min.play_addr.data_size ? video : min);
    logger.debug(`[douyin] 无档位满足体积上限，退回最小源 ${(smallest.play_addr.data_size / (1024 * 1024)).toFixed(2)}MB`);
    return [smallest];
};
