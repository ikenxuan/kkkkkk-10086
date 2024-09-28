import { DouyinDataOptionsMap, BilibiliDataOptionsMap, XiaohongshuDataOptionsMap } from '../types/index.js'
import { FastifyInstance } from 'fastify'
interface initClientParams {
    /** 抖音ck */
    douyin: string;
    /** B站ck */
    bilibili: string;
}
interface AmagiInstance {
    /** Fastify 实例 */
    Instance: FastifyInstance;
    /**
     * amagi.getDouyinData 可能在未来版本废弃，建议直接导入 getDouyinData 方法使用
     * @deprecated
     */
    getDouyinData: <T extends keyof DouyinDataOptionsMap>(type: T, cookie?: string, options?: DouyinDataOptionsMap[T]) => Promise<any>;
    /**
     * amagi.getBilibiliData 可能在未来版本废弃，建议直接导入 getBilibiliData 方法使用
     * @deprecated
     */
    getBilibiliData: <T extends keyof BilibiliDataOptionsMap>(type: T, cookie?: string, options?: BilibiliDataOptionsMap[T]) => Promise<any>;
    /**
     * amagi.getXiaohongshuiData 可能在未来版本废弃，建议直接导入 getXiaohongshuiData 方法使用
     * @deprecated
     */
    getXiaohongshuData: <T extends keyof XiaohongshuDataOptionsMap>(type: T, cookie: string, options: XiaohongshuDataOptionsMap[T]) => Promise<any>;
    /**
     *
     * @param client Fastify 实例
     * @param port 监听端口
     * @returns
     */
    startClient: (client: FastifyInstance, port: 4567) => Promise<void>;
}
export declare class amagi {
  private douyin
  private bilibili
  /**
     *
     * @param data 一个对象，里面包含 douyin 和 bilibili 两个字段，分别对应抖音和B站cookie
     */
  constructor(data: initClientParams);
  /**
     * 初始化 fastify 实例
     * @param log log 是否启用日志，默认为 false
     * @returns amagi 实例
     */
  initServer(log?: boolean): AmagiInstance;
}
export {}
