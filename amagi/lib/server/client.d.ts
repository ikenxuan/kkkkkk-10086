import { DouyinDataOptionsMap, BilibiliDataOptionsMap } from '../types/index.js'
import { FastifyInstance } from 'fastify'
interface initClientParams {
    /** 抖音ck */
    douyin?: string;
    /** B站ck */
    bilibili?: string;
}
interface AmagiInstance {
    /** Fastify 实例 */
    Instance: FastifyInstance;
    /**
     * amagi.getDouyinData 可能在未来版本废弃，建议直接导入 getDouyinData 方法使用
     * @deprecated
     */
    getDouyinData: <T extends keyof DouyinDataOptionsMap>(type: T, options?: DouyinDataOptionsMap[T]) => Promise<any>;
    /**
     * amagi.getBilibiliData 可能在未来版本废弃，建议直接导入 getBilibiliData 方法使用
     * @deprecated
     */
    getBilibiliData: <T extends keyof BilibiliDataOptionsMap>(type: T, options?: BilibiliDataOptionsMap[T]) => Promise<any>;
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
     *
     * @param port 监听端口
     * @default port 4567
     * @returns
     */
  startClient(port?: number): AmagiInstance;
  getDouyinData: <T extends keyof DouyinDataOptionsMap>(type: T, options?: DouyinDataOptionsMap[T]) => Promise<any>
  getBilibiliData: <T extends keyof BilibiliDataOptionsMap>(type: T, options?: BilibiliDataOptionsMap[T]) => Promise<any>
}
export {}
