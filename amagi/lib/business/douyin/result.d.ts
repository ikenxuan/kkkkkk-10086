import { DouyinDataType, DouyinOptionsType, GetDataResponseType } from '../../types/index.js'
interface configParams {
    /** 请求数据的类型 */
    type: keyof typeof DouyinDataType;
    /** 抖音用户ck */
    cookie: string;
}
export default function DouyinResult(config?: configParams, options?: DouyinOptionsType): Promise<GetDataResponseType>
export {}
