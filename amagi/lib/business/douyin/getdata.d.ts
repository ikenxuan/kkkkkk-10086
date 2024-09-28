import { DouyinDataType, DouyinOptionsType, NetworksConfigType } from '../../types/index.js'
export default class DouyinData {
  type: keyof typeof DouyinDataType
  headers: any
  URL: string | undefined
  constructor(type: keyof typeof DouyinDataType, cookie: string | undefined);
  GetData(data?: DouyinOptionsType): Promise<any>;
  GlobalGetData(options: NetworksConfigType): Promise<any>;
}
