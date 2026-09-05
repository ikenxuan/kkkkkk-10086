/**
 * 抖音号（unique_id）→ sec_uid，取数走 amagi 的 `fetchGuestUserInfo`（免 cookie、免签名）。
 *
 * 不用 `searchContent`：它要签名（会被按概率拦），而且是模糊匹配 —— `ensureConfigFields`
 * 精确匹配失败后会退回 `users[0]`，可能把订阅挂到同名的另一个人身上且不报错。
 */
import { buildAmagiRequestConfig, douyinGuest } from '../../../module/utils/amagiClient.js';
import { isRecord } from '../../../module/utils/record.js';
/** amagi 回的是原样信封，两层 `data` 都看一眼（不同路径的嵌套层数不一样） */
const readUserInfo = (response) => {
    if (!isRecord(response))
        return undefined;
    const data = isRecord(response.data) ? response.data : undefined;
    const nested = isRecord(data?.data) ? data.data : undefined;
    const user = (isRecord(data?.user_info) && data.user_info) ||
        (isRecord(nested?.user_info) && nested.user_info) ||
        undefined;
    return isRecord(user) ? user : undefined;
};
/** @returns 解析不出来时返回 `null`，由调用方决定要不要退回搜索 */
export const resolveDouyinUserByShortId = async (shortId, options = {}) => {
    const id = String(shortId ?? '').trim();
    if (!id)
        return null;
    const fetchUserInfo = options.fetchUserInfo ?? (async (uniqueId) => {
        const request = douyinGuest('fetchGuestUserInfo');
        return await request?.({ unique_id: uniqueId }, '', buildAmagiRequestConfig());
    });
    let user;
    try {
        user = readUserInfo(await fetchUserInfo(id));
    }
    catch {
        // 号不存在时抖音回 status_code 5，被 wrapAmagiClient 抛成 AmagiError。
        // 那是干净的失败信号而不是异常，吞掉返回 null
        return null;
    }
    if (!user)
        return null;
    const secUid = typeof user.sec_uid === 'string' ? user.sec_uid : '';
    if (!secUid)
        return null;
    // 精确性守卫：接口回的 unique_id 必须与输入一致，绝不退回「差不多的那个人」
    const returned = String(user.unique_id ?? '').trim();
    if (returned && returned.toLowerCase() !== id.toLowerCase())
        return null;
    return {
        sec_uid: secUid,
        nickname: String(user.nickname ?? ''),
        unique_id: returned || id,
        short_id: user.short_id ? String(user.short_id) : undefined
    };
};
