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
/**
 * QQ 群头像直链。非 QQ 群（QQBot 频道等）拿不到这个地址，
 * 此时返回空串——模板那格是个圆角容器，空图只是不显示，不会炸。
 */
const groupAvatarUrl = (groupId) => /^\d{5,}$/.test(groupId) ? `https://p.qlogo.cn/gh/${groupId}/${groupId}/640` : '';
/**
 * 判断一条 `群号:机器人账号` 是不是指定的群。
 *
 * 配置里的 group_id 条目带机器人账号后缀，比较时只能看冒号前那一段。
 * 两个平台原来各写了一遍 `item?.split(':')[0] === String(groupId)`，
 * 订阅 / 退订 / 改备注三条路径都要用，抽出来避免其中一处漏掉 String() 转换 ——
 * 群号在事件上有时是 number，`===` 直接比会静默不匹配。
 */
export const matchesGroup = (entry, groupId) => (entry ?? '').split(':')[0] === String(groupId);
/** 组装 `userlist` 契约里的 groupInfo */
export const buildPushListGroupInfo = (event) => {
    const groupId = String(event.group_id ?? '');
    return {
        groupId,
        groupName: event.group_name || groupId || '未知群聊',
        groupAvatar: groupAvatarUrl(groupId)
    };
};
