import { FastifyInstance } from 'fastify'
/**
 * 启动本地 http 服务
 * @param client Fastify 实例
 * @param port 监听端口
 * @returns
 */
export declare const startClient: (client: FastifyInstance, port: 4567) => Promise<void>
/**
 * 已废弃，请使用 startClient 方法
 * @deprecated
 */
export declare const StartClient: (client: FastifyInstance, port: 4567) => Promise<void>
