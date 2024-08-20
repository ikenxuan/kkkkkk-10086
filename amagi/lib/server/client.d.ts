import { BilibiliDataType, DouyinDataType } from '../types/index.js'
import { FastifyInstance } from 'fastify'
interface initClientParams {
    /** 抖音ck */
    douyin: string;
    /** B站ck */
    bilibili: string;
}
interface amagiInstance {
    /** Fastify 实例 */
    Instance: FastifyInstance;
    /**
     * amagi.GetDouyinData 已废弃，请直接导入 GetDouyinData 方法使用
     * @deprecated
     */
    GetDouyinData: (data: {
        type: keyof typeof DouyinDataType;
    }) => Error | any;
    /**
     * amagi.GetBilibiliData 已废弃！请直接导入 GetBilibiliData 方法使用
     * @deprecated
     */
    GetBilibiliData: (data: {
        type: keyof typeof BilibiliDataType;
    }) => Error | any;
}
export declare class client {
  /** douyin cookies */
  douyin: string
  /** bilibili cookes */
  bilibili: string
  /**
     *
     * @param cookies 包含抖音和B站cookie的参数对象
     */
  constructor(cookies: initClientParams);
  /**
     * 初始化 fastify 实例
     * @param log 是否启用日志
     * @returns fastify 实例
     */
  initServer(log?: boolean): Promise<amagiInstance>;
  GetDouyinData: (data: {
        type: keyof typeof DouyinDataType;
    }) => Error | any
  GetBilibiliData: (data: {
        type: keyof typeof BilibiliDataType;
    }) => {
        /**
         * @deprecated
         */
        result: () => Promise<never>;
    }
}
export {}
