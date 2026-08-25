/**
 * 给 `@types/trss-yunzai`（实为 `@kaguyajs/trss-yunzai-types`）补一个它没声明、但宿主真的会挂的字段。
 *
 * 为什么需要这个文件：TRSS-Yunzai 的每个 ws 适配器在 connect 时都会写
 * `Bot[self_id].ws = ws`（见宿主 plugins/adapter/OneBotv11.js 的 connect），
 * 而包里的 `Client` 没有这个键。本插件靠它判「通信方式」那一格是
 * webSocketServer 还是 webSocketClient（`ws` 包只在主动外连的客户端实例上写 `url`，
 * 服务端 accept 出来的连接没有，实测确认）。
 *
 * 只补 `ws`：`stat.start_time` 看着像缺，其实包里通过 icqq 的 `Client` 基类已经声明成
 * 必填的 `number`（icqq.d.ts 里 `get stat(): { start_time: number, ... }`），不需要补，
 * 补了反而会因为「访问器被实例属性覆盖」而报 TS2610。
 *
 * 增补而不是改包：包是依赖，升级会被覆盖；这里用 TS 的模块增补（interface 与 class 声明合并），
 * 包升级后如果自己补上了 `ws`，这个文件删掉即可，不会静默失效。
 */
declare module 'trss-yunzai' {
  interface Client {
    /** 适配器挂上来的 WebSocket 连接。服务端 accept 的连接没有 `url`，主动外连的有。 */
    ws?: unknown
  }
}

export {}
