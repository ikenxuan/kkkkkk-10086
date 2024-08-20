import { DouyinDataType } from '../../types/index.js'
interface IDDataTypes {
    type: DouyinDataType;
    aweme_id?: string;
    sec_uid?: string;
}
/**
 * return aweme_id
 * @param {string} url 视频分享连接
 * @returns
 */
export default function GetDouyinID(url: string): Promise<IDDataTypes>
export {}
