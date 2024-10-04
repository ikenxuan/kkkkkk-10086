import { XiaohongshuDataType, XiaohongshuOptionsType, GetDataResponseType } from '../../types/index.js';
interface configParams {
    /** 请求数据的类型 */
    type: keyof typeof XiaohongshuDataType;
    /** 小红书用户ck */
    cookie: string;
}
export default function XiaohongshuResult(config?: configParams, options?: XiaohongshuOptionsType): Promise<GetDataResponseType>;
export {};
