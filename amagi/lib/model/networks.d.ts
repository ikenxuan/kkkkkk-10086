import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { NetworksConfigType } from '../types/index.js'
interface HeadersObject {
    [key: string]: string;
}
export default class Networks {
  url: string
  method: string
  headers: HeadersObject
  type: string
  body?: any
  axiosInstance: any
  isGetResult: boolean
  timeout: number
  timer: NodeJS.Timeout | undefined
  data: {}
  constructor(data: NetworksConfigType);
  get config(): AxiosRequestConfig;
  getfetch(): Promise<AxiosResponse | boolean>;
  returnResult(): Promise<AxiosResponse>;
  /** 最终地址（跟随重定向） */
  getLongLink(): Promise<string>;
  /** 获取首个302 */
  getLocation(): Promise<string>;
  /** 获取数据并处理数据的格式化，默认json */
  getData(new_fetch?: string): Promise<any | boolean>;
  getHeadersAndData(): Promise<{
        headers: any;
        data: any;
    }>;
}
export {}
