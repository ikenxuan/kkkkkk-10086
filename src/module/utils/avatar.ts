/**
 * 触发者头像地址。
 *
 * 目前只有一个消费方：登录二维码把它嵌到中心当 logo（上游 e498c5f）。
 * 取不到就返回 undefined —— 模板侧 `QRCodeWithAvatar` 缺 `avatarUrl` 时退化成普通二维码，
 * 所以这条路上任何失败都不该影响登录流程本身。
 */
import type { MessageEvent } from '@/types/message'

/**
 * 取头像用得上的那部分事件字段。
 *
 * 形状不自己编，从 `@/types/message` 的 `MessageEvent` 上 `Pick` —— 那是本仓对宿主
 * 事件的镜像（`@types/trss-yunzai` 的 `GroupEvent | PrivateEvent`）。
 * 用 `Pick` 而不是整个 `MessageEvent`：两个 login 的形参是各自的窄接口，
 * 要它们去满足整份事件等于把 `bot` / `reply` 的形状也一起绑上。
 */
export type AvatarTriggerEvent = Pick<MessageEvent, 'user_id' | 'sender'>

/**
 * 纯数字 ID 才是 QQ 号。
 *
 * 判据与 `platform/common/pushList.ts` 的 `groupAvatarUrl`、
 * `platform/common/userRanking.ts` 的 `userAvatarUrl` 一致：QQBot 的 openid
 * 拼进这个地址必然 404，返回 undefined 好过塞一个坏地址 ——
 * 模板侧 `loadQRCodeAvatar` 要等 5 秒超时才放弃，二维码也就晚 5 秒才发出去。
 */
export const qqUserAvatarUrl = (userId: string): string | undefined =>
  /^\d{5,}$/.test(userId) ? `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640` : undefined

/**
 * 取触发者头像地址。
 *
 * 只按 QQ 号拼 `q1.qlogo.cn`，不去读 `sender` 上可能存在的头像字段：宿主事件的
 * `sender` 在 `@types/trss-yunzai` 里逐字段声明过（icqq.d.ts 的 `GroupMessage.sender` /
 * `PrivateMessage.sender`），里面**没有**头像这一项，写了就是防御一个查不到依据的形状。
 *
 * 也刻意**不**走 `pickFriend().getAvatarUrl()` 之类的 RPC：这是出图路径上的一格装饰，
 * 为它串一次协议请求会把二维码拖慢，超时还要另写一套兜底 ——
 * 与 `userRanking.ts` 里「为一行昵称不发 RPC」是同一套取舍。
 *
 * 字段次序照 `ErrorHandler/render.ts` 的 `resolveUserId`：`user_id` 优先、
 * 退回 `sender.user_id`，且只认 snake_case（camelCase 的 `userId` 全宿主无一处产生，
 * 那边已经把那层兼容删掉了）。
 *
 * @param event 触发登录的消息事件；主动推送没有事件对象，所以允许缺省
 * @returns 头像地址；取不到时 undefined
 */
export const resolveTriggerAvatarUrl = (event?: AvatarTriggerEvent): string | undefined =>
  // 判据只有 `qqUserAvatarUrl` 一处：凡不是 5 位以上纯数字的一律 undefined，
  // 所以这里不需要任何前置闸门（原来写过一个 `=== undefined || === null`，
  // 删掉之后所有用例照样全绿 —— 它不改变行为）。`?? ''` 只是别把字面量 "undefined"
  // 交给那个正则去判，读起来更直白。
  qqUserAvatarUrl(String(event?.user_id ?? event?.sender?.user_id ?? ''))
