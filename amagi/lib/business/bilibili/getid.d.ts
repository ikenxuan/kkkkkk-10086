import { BilibiliDataType } from '../../types/index.js'
interface IDDataTypes {
    /**
     * 类型
     */
    type: BilibiliDataType;
    /**
     * 作品ID、BV号、AV号
     */
    id?: string;
    /**
     * 动态ID、
     */
    dynamic_id?: string;
    /**
     * 用户UID
     */
    host_mid?: string;
}
/**
 * return aweme_id
 * @param {string} url 分享连接
 * @returns
 */
export default function GetBilibiliID(url: string): Promise<IDDataTypes>
export {}
