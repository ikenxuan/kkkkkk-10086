import { BilibiliDataType, BilibiliOptionsType, GetDataResponseType } from '../../types/index.js';
interface configParams {
    /** 请求数据的类型 */
    type: keyof typeof BilibiliDataType;
    /** B站用户ck */
    cookie: string | undefined;
}
/**
 *
 * @param options
 * @param config
 * @returns
 */
export default function BilibiliResult(config?: configParams, options?: BilibiliOptionsType): Promise<GetDataResponseType | any>;
export {};
