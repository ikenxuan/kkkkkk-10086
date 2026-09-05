/**
 * 抖音原声（`music_work`）取数，两条腿。取数一律走 amagi，本模块只负责读响应。
 *
 * 1. {@link fetchDouyinMusicDetail} —— `fetchMusicInfo`（`music/detail`）。一次请求就带 mp3、
 *    权威 `user_count` 和 `original_musician_display_name`；要 `x-secsdk-web-signature`，
 *    amagi 签不出来时恒 403。
 * 2. {@link resolveDouyinMusicInfo} —— `fetchGuestMusicInfo` / `fetchGuestMusicAwemeList`
 *    两条免鉴权接口 + `parseWork` 补 mp3。免 cookie、免签名，所以第 1 条挂了照样出得来卡片，
 *    别因为第 1 条好了就删掉它。缺口：本体没有 `play_url`、`user_count` 只有近似值。
 *
 * 两条都挂时不在这里发明失败提示，调用方退回带错误卡片的 `fetchMusicInfo`。
 */
import { buildAmagiRequestConfig, douyinGuest } from '../../../module/utils/amagiClient.js';
import { isRecord } from '../../../module/utils/record.js';
const hostLogger = globalThis.logger;
/** 从 amagi 的原样信封里剥一个字段，两层 `data` 都看（不同路径的嵌套层数不一样） */
const readEnvelope = (response, field) => {
    if (!isRecord(response))
        return undefined;
    const data = isRecord(response.data) ? response.data : undefined;
    const nested = isRecord(data?.data) ? data.data : undefined;
    return data?.[field] ?? nested?.[field];
};
/** `extra` 是一段 JSON 字符串，`owner_nickname` / `high_level_follow_info` 只在里面 */
const readMusicExtra = (music) => {
    if (!isRecord(music) || typeof music.extra !== 'string')
        return {};
    try {
        const parsed = JSON.parse(music.extra);
        return isRecord(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
};
/**
 * 「创建这条原声的那个作品」的 aweme_id，从 `extra` 的原始文本里正则抠，不走 `JSON.parse`：
 * `extract_item_id` 在 JSON 里是数字，19 位超出 MAX_SAFE_INTEGER 必然丢精度
 * （`…246902` → `…247000`）。拿丢精度的 id 去 `parseWork` 不报错，只是查不到作品。
 */
export const readDouyinMusicSourceAwemeId = (music) => {
    if (!isRecord(music) || typeof music.extra !== 'string')
        return '';
    return /"extract_item_id"\s*:\s*(\d+)/.exec(music.extra)?.[1] ?? '';
};
/** 游客接口取原声本体，失败返回 `null` */
export const fetchGuestDouyinMusicInfo = async (musicId, options = {}) => {
    const id = String(musicId ?? '').trim();
    if (!id)
        return null;
    const request = options.fetchGuestMusicInfo ?? (async (mid) => {
        const call = douyinGuest('fetchGuestMusicInfo');
        return await call?.({ music_id: mid }, '', buildAmagiRequestConfig());
    });
    try {
        const info = readEnvelope(await request(id), 'music_info');
        return isRecord(info) && typeof info.mid === 'string' && info.mid !== '' ? info : null;
    }
    catch (error) {
        // 原声不存在时抖音回非 0 的 status_code，被抛成 AmagiError —— 干净的失败信号，吞掉走兜底
        hostLogger?.debug?.(`[抖音原声] 游客接口取原声失败 music_id=${id}`, error);
        return null;
    }
};
/**
 * 「用了这个原声的作品」的 aweme_id 列表，只在 `extract_item_id` 缺失时用来找个能出 mp3 的
 * 源作品。这里的 `aweme_id` 是字符串，没有精度问题。
 */
export const fetchGuestDouyinMusicAwemeIds = async (musicId, options = {}) => {
    const id = String(musicId ?? '').trim();
    if (!id)
        return [];
    const requested = options.count ?? 0;
    const count = Number.isSafeInteger(requested) && requested > 0 ? requested : 10;
    const request = options.fetchGuestMusicAwemeList ?? (async (mid, number) => {
        const call = douyinGuest('fetchGuestMusicAwemeList');
        return await call?.({ music_id: mid, number }, '', buildAmagiRequestConfig());
    });
    try {
        const list = readEnvelope(await request(id, count), 'aweme_list');
        if (!Array.isArray(list))
            return [];
        return list
            .map((item) => (isRecord(item) && typeof item.aweme_id === 'string' ? item.aweme_id : ''))
            .filter(Boolean);
    }
    catch (error) {
        hostLogger?.debug?.(`[抖音原声] 游客接口取作品列表失败 music_id=${id}`, error);
        return [];
    }
};
const firstNonEmptyString = (...values) => {
    for (const value of values) {
        if (typeof value === 'string' && value.trim() !== '')
            return value;
    }
    return '';
};
/**
 * 原声的「作曲/作者」显示名：显示名 → owner_nickname → extra 里的 owner_nickname → author。
 * 原来写在 `douyin.ts` 的载荷里，`a || b === '' ? c : d` 的运算符优先级是错的。
 */
export const getDouyinMusicianName = (music) => {
    if (!isRecord(music))
        return '';
    const extra = readMusicExtra(music);
    return firstNonEmptyString(music.original_musician_display_name, music.owner_nickname, extra.owner_nickname, music.author);
};
/**
 * 「多少个作品用了这条原声」。游客的 `music_info` 没有 `user_count`，只在
 * `extra.high_level_follow_info` 里，而那本身又是一段 JSON 字符串，所以要解两层。
 */
const readMusicUseCount = (guestExtra) => {
    const raw = guestExtra.high_level_follow_info;
    if (typeof raw !== 'string' || raw.trim() === '')
        return null;
    try {
        const parsed = JSON.parse(raw);
        const count = Number(isRecord(parsed) ? parsed.music_use_count : NaN);
        return Number.isFinite(count) && count > 0 ? count : null;
    }
    catch {
        return null;
    }
};
/**
 * 把游客接口的原声本体和源作品上的完整 music 对象合成一个 `music_info`，形状保持和
 * `fetchMusicInfo` 一致。三个字段不能指望 spread 顺序：`mid` 认游客那个字符串；
 * 作品里的 `user_count` 恒为 0，真值在游客的 `extra`；`owner_nickname` 游客本体没有。
 */
export const mergeDouyinMusicInfo = (guestInfo, workMusic) => {
    const guest = isRecord(guestInfo) ? guestInfo : {};
    const work = isRecord(workMusic) ? workMusic : {};
    const guestExtra = readMusicExtra(guest);
    const merged = { ...guest, ...work };
    const mid = firstNonEmptyString(guest.mid, work.mid, work.id_str);
    if (mid)
        merged.mid = mid;
    const workCount = Number(work.user_count);
    if (!Number.isFinite(workCount) || workCount <= 0) {
        const useCount = readMusicUseCount(guestExtra);
        merged.user_count = useCount ?? (Number.isFinite(workCount) ? workCount : 0);
    }
    const nickname = firstNonEmptyString(work.owner_nickname, guestExtra.owner_nickname);
    if (nickname)
        merged.owner_nickname = nickname;
    // 超集，唯一对不上的是 `id`：游客接口不下发，且它本来就是丢了精度那份
    return merged;
};
/** 作品上的 music 对象。带 `play_url` 才算有效，排掉游客作品列表里那种空壳 music */
const readWorkMusic = (response) => {
    const aweme = readEnvelope(response, 'aweme_detail');
    const music = isRecord(aweme) && isRecord(aweme.music) ? aweme.music : undefined;
    return music && isRecord(music.play_url) ? music : undefined;
};
/**
 * 游客那条腿：本体 + 源作品补 mp3，游客接口也挂了才返回 `null`。
 * `parseWork` 失败不致命，只是结果没有 `play_url` —— 卡片照出，音频那步跳过。
 */
export const resolveDouyinMusicInfo = async (musicId, deps = {}) => {
    const id = String(musicId ?? '').trim();
    if (!id)
        return null;
    const guest = await fetchGuestDouyinMusicInfo(id, deps);
    if (!guest)
        return null;
    const parseWork = deps.parseWork;
    const requestedAttempts = deps.maxWorkAttempts ?? 0;
    const maxAttempts = Number.isSafeInteger(requestedAttempts) && requestedAttempts > 0 ? requestedAttempts : 3;
    const tried = new Set();
    let workMusic;
    let sourceAwemeId = '';
    const tryWork = async (awemeId) => {
        if (!parseWork || !awemeId || tried.has(awemeId) || tried.size >= maxAttempts)
            return false;
        tried.add(awemeId);
        try {
            const music = readWorkMusic(await parseWork(awemeId));
            if (!music)
                return false;
            workMusic = music;
            sourceAwemeId = awemeId;
            return true;
        }
        catch (error) {
            // 源作品可能已删、私密，或这次被 Argus 拦下 —— 都只影响 mp3，不影响原声本体
            hostLogger?.debug?.(`[抖音原声] 源作品 ${awemeId} 取数失败，换下一个候选`, error);
            return false;
        }
    };
    if (parseWork) {
        // 首选 extra 里那个「创建这条原声的作品」，一次请求就够；缺失才去问作品列表
        if (!await tryWork(readDouyinMusicSourceAwemeId(guest))) {
            for (const awemeId of await fetchGuestDouyinMusicAwemeIds(id, deps)) {
                if (await tryWork(awemeId) || tried.size >= maxAttempts)
                    break;
            }
        }
    }
    const music_info = mergeDouyinMusicInfo(guest, workMusic);
    // 取 `mark` 再退回 `info`，不写 `hostLogger?.mark?.()` —— 宿主没有 mark 时那样写会静默丢日志
    const emitLog = hostLogger?.mark ?? hostLogger?.info;
    emitLog?.call(hostLogger, `[抖音原声] 游客接口取数成功 music_id=${id} 源作品=${sourceAwemeId || '无'} 音频=${workMusic ? '有' : '无'}`);
    return { music_info, source: workMusic ? 'guest+work' : 'guest', sourceAwemeId };
};
/**
 * 取 `music_info`。判据是认得出这条原声（有 `mid` 或 `id_str`），
 * 刻意不要求 `play_url` —— 拿不到 mp3 也出卡片。
 */
const readMusicDetail = (response) => {
    const music = readEnvelope(response, 'music_info');
    if (!isRecord(music))
        return undefined;
    return firstNonEmptyString(music.mid, music.id_str) ? music : undefined;
};
/**
 * 主通道：amagi 的 `fetchMusicInfo`（`music/detail`）。失败一律归一成 `null`、不上抛 ——
 * 否则游客那条兜底走不到。签不出 `x-secsdk-web-signature` 时这条恒 403，落到游客是设计意图。
 */
export const fetchDouyinMusicDetail = async (musicId, deps = {}) => {
    const id = String(musicId ?? '').trim();
    const fetchMusicInfo = deps.fetchMusicInfo;
    if (!id || !fetchMusicInfo)
        return null;
    let music;
    try {
        music = readMusicDetail(await fetchMusicInfo(id));
    }
    catch (error) {
        hostLogger?.debug?.(`[抖音原声] music/detail 取数失败，退回游客接口 music_id=${id}`, error);
        return null;
    }
    if (!music) {
        hostLogger?.debug?.(`[抖音原声] music/detail 没回可用的 music_info，退回游客接口 music_id=${id}`);
        return null;
    }
    const emitLog = hostLogger?.mark ?? hostLogger?.info;
    emitLog?.call(hostLogger, `[抖音原声] music/detail 取数成功 music_id=${id} 字段=${Object.keys(music).length} 音频=${isRecord(music.play_url) ? '有' : '无'}`);
    return { music_info: music, source: 'music_detail', sourceAwemeId: '' };
};
