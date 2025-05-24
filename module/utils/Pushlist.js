import { getDouyinData, getBilibiliData } from '@ikenxuan/amagi'
import { Common, Render, Config } from '../utils/index.js'

/**
 *
 * @param {object} e 消息对象
 * @param {array} list 推送数组
 * @param {string} platform 平台
 * @returns {any} 推送消息
 */
export default async function Pushlist (e, list, platform) {
  const renderOpt = []
  if (platform === 'douyin') {
    for (const item of list['douyin']) {
      const userInfo = await getDouyinData('用户主页数据', Config.cookies.douyin, { sec_uid: item.sec_uid, typeMode: 'strict' })
      renderOpt.push({
        avatar_img: userInfo.user.avatar_larger.url_list[0],
        username: userInfo.user.nickname,
        short_id: userInfo.user.unique_id === '' ? userInfo.user.short_id : userInfo.user.unique_id,
        fans: Common.count(userInfo.user.follower_count),
        total_favorited: Common.count(userInfo.user.total_favorited),
        following_count: Common.count(userInfo.user.following_count)
      })
    }
  } else {
    for (const item of list['bilibili']) {
      const userInfo = await getBilibiliData('用户主页数据', Config.cookies.bilibili, { host_mid: item.host_mid, typeMode: 'strict' })
      renderOpt.push({
        avatar_img: userInfo.data.card.face,
        username: userInfo.data.card.name,
        host_mid: userInfo.data.card.mid,
        fans: Common.count(userInfo.data.follower),
        total_favorited: Common.count(userInfo.data.like_num),
        following_count: Common.count(userInfo.data.card.attention)
      })
    }
  }

  if(renderOpt.length === 0) {
    if(platform === 'douyin') {
      await e.reply(`当前群：${e.group_name}(${e.group_id})\n没有设置任何抖音博主推送！\n可使用「#设置抖音推送 + 抖音号」进行设置`)
    } else {
      await e.reply(`当前群：${e.group_name}(${e.group_id})\n没有设置任何B站UP推送！\n可使用「#设置B站推送 + UP主UID」进行设置`)
    }
    return false
  }

  const img = await Render.render(
    platform === 'douyin' ? 'douyin/userlist' : 'bilibili/userlist',
    { renderOpt }
  )
  return img
}
