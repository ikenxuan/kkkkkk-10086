/** 小红书官方站点与分享短链域名。 */
export const XIAOHONGSHU_LINK_PATTERN = /(xiaohongshu\.com|xhslink\.(?:com|cn))/i;
/** 判断文本是否包含小红书链接。 */
export const isXiaohongshuLink = (value) => XIAOHONGSHU_LINK_PATTERN.test(value);
/** 构造可安全放入二维码的笔记分享链接。 */
export const buildXiaohongshuShareUrl = (noteId, xsecToken) => {
    const url = new URL(`https://www.xiaohongshu.com/discovery/item/${encodeURIComponent(noteId)}`);
    // source / xhsshare 只是来源打点，可有可无；但 xsec_source 是和 xsec_token 成对校验的：
    // 小红书对「带 token 却不带 xsec_source」的链接经常判成失效，扫码落到「笔记不可见/请登录」。
    // 所以四个参数照抄上游的官方 pc 分享形态，缺一不可，顺序也保持一致。
    url.searchParams.set('source', 'webshare');
    url.searchParams.set('xhsshare', 'pc_web');
    if (xsecToken)
        url.searchParams.set('xsec_token', xsecToken);
    url.searchParams.set('xsec_source', 'pc_share');
    return url.toString();
};
