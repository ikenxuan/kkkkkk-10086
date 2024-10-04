import { XiaohongshuDataType, XiaohongshuOptionsType } from '../../types/index.js';
export default class XiaohongshuData {
    type: any;
    headers: any;
    constructor(type: keyof typeof XiaohongshuDataType, cookie: string);
    GetData(data?: XiaohongshuOptionsType): Promise<any>;
    GlobalGetData(options: {
        url: string;
        method?: string;
        headers?: any;
        body?: any;
    }): Promise<any>;
}
