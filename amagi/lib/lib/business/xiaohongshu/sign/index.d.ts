declare class S {
    x_b3_traceid(): string;
    /**
     *
     * @param url 接口地址
     * @param cookie 小红书用户 ck
     * @returns
     */
    x_s(url: string, cookie: string, body?: any): string;
    x_s_common(data: {
        x_s: string;
        cookie: string;
    }): string;
}
export declare const XiaohongshuSign: S;
export {};
