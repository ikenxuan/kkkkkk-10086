/**
 * 抖音 / B站两个 `userlist` 模板共用的群信息块。
 *
 * 模板里是 `props.data.groupInfo.groupAvatar` 这种无守卫的深访问，
 * 而两个调用点（douyin/push.ts、bilibili/push.ts）原来都只传了 `renderOpt`，
 * 于是 `groupInfo` 为 undefined，`#抖音推送列表` / `#B站推送列表` 一执行就
 * 抛 `Cannot read properties of undefined (reading 'groupAvatar')`。
 * 契约校验之前一直没报这个缺字段，是因为同一个字面量里 `renderOpt` 的类型不匹配
 * 把缺失属性的报错盖住了。
 */

/** 推送列表事件上能读到的群字段，各适配器命名不一 */
export interface PushListGroupEvent {
  group_id?: string | number
  groupId?: string | number
  group_name?: string
  groupName?: string
}

/**
 * QQ 群头像直链。非 QQ 群（QQBot 频道等）拿不到这个地址，
 * 此时返回空串——模板那格是个圆角容器，空图只是不显示，不会炸。
 */
const groupAvatarUrl = (groupId: string): string =>
  /^\d{5,}$/.test(groupId) ? `https://p.qlogo.cn/gh/${groupId}/${groupId}/640` : ''

/** 组装 `userlist` 契约里的 groupInfo */
export const buildPushListGroupInfo = (event: PushListGroupEvent) => {
  const groupId = String(event.group_id ?? event.groupId ?? '')
  return {
    groupId,
    groupName: event.group_name || event.groupName || groupId || '未知群聊',
    groupAvatar: groupAvatarUrl(groupId)
  }
}
