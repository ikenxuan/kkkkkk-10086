import { BilibiliDataType, BilibiliOptionsType, NetworksConfigType } from '../../types/index.js';
export default class BilibiliData {
    type: keyof typeof BilibiliDataType;
    headers: any;
    URL: string | undefined;
    constructor(type: keyof typeof BilibiliDataType, cookie: string | undefined);
    GetData(data?: BilibiliOptionsType): Promise<any>;
    GlobalGetData(options: NetworksConfigType): Promise<any>;
}
