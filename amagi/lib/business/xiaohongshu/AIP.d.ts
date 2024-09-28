import { XiaohongshuDataOptionsMapKeys } from '../../types/index.js'
declare class XiaohongshuAPI {
  单个笔记(data: XiaohongshuDataOptionsMapKeys['NoteInfoParams']): XiaoHongShuAPIType;
}
interface XiaoHongShuAPIType {
    /** 请求地址 */
    url: string;
    /** 请求方法 */
    method: string;
    /** 请求体 */
    body: any;
}
declare const _default: XiaohongshuAPI
export default _default
