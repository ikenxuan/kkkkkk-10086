import axios from 'axios';
import crypto from 'crypto';
const mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26,
    17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
];
// 对 imgKey 和 subKey 进行字符顺序打乱编码
const getMixinKey = (orig) => mixinKeyEncTab
    .map((n) => orig[n])
    .join('')
    .slice(0, 32);
// 为请求参数进行 wbi 签名
function encWbi(params, img_key, sub_key) {
    const mixin_key = getMixinKey(img_key + sub_key);
    const curr_time = Math.round(Date.now() / 1000);
    const chr_filter = /[!'()*]/g;
    Object.assign(params, { wts: curr_time }); // 添加 wts 字段
    // 按照 key 重排参数
    const query = Object.keys(params)
        .sort()
        .map((key) => {
        // 过滤 value 中的 "!'()*" 字符
        const value = params[key].toString().replace(chr_filter, '');
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
        .join('&');
    const wbi_sign = crypto.createHash('md5').update(query + mixin_key).digest('hex'); // 计算 w_rid
    return `&wts=${curr_time}` + `&w_rid=${wbi_sign}`;
}
// 获取最新的 img_key 和 sub_key
async function getWbiKeys(cookie) {
    const res = await axios('https://api.bilibili.com/x/web-interface/nav', {
        headers: {
            Cookie: cookie
        }
    });
    const responseJson = res.data;
    const response = responseJson; // 类型断言
    // 确保response是ResponseData类型后再解构
    const { data: { wbi_img: { img_url, sub_url } } } = response;
    return {
        img_key: img_url.slice(img_url.lastIndexOf('/') + 1, img_url.lastIndexOf('.')),
        sub_key: sub_url.slice(sub_url.lastIndexOf('/') + 1, sub_url.lastIndexOf('.'))
    };
}
export default async function wbi_sign(BASEURL, cookie) {
    const web_keys = await getWbiKeys(cookie);
    const url = new URL(BASEURL);
    const params = {};
    for (const [key, value] of url.searchParams.entries()) {
        params[key] = value;
    }
    const query = encWbi(params, web_keys.img_key, web_keys.sub_key);
    return query;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2JpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2J1c2luZXNzL2JpbGliaWxpL3NpZ24vd2JpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sS0FBSyxNQUFNLE9BQU8sQ0FBQTtBQUN6QixPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUE7QUFFM0IsTUFBTSxjQUFjLEdBQUc7SUFDckIsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDNUosRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7Q0FDdkYsQ0FBQTtBQUVELCtCQUErQjtBQUMvQixNQUFNLFdBQVcsR0FBRyxDQUFD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