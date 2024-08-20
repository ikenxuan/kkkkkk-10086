import { logger } from '../model/index.js'
/**
 * 启动本地 http 服务
 * @param client Fastify 实例
 * @param port 监听端口
 * @returns
 */
export const StartClient = async (client, port) => {
  return client.listen({ port: port, host: '::' }, (_err, _address) => {
    if (_err)
      client.log.error(_err)
    logger.mark(`amagi server listening on ${port} port. API docs: https://amagi.apifox.cn`)
  })
}
