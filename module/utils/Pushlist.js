import DouyinData from '../platform/douyin/getdata.js'
import Bilidata from '../platform/bilibili/getdata.js'
import Render from '../utils/Render.js'

/**
 *
 * @param {object} e 消息对象
 * @param {array} list 推送数组
 * @returns {any} 推送消息
 */
export default async function Pushlist (e, list) {
  const transformedData = []
  if (list['douyin']) {
    for (const item of list['douyin']) {
      const UserInfoData = await new DouyinData('UserInfoData').GetData({ user_id: item.sec_uid })
      transformedData.push({
        avatar_img: UserInfoData.user.avatar_larger.url_list[0],
        username: UserInfoData.user.nickname,
        short_id: UserInfoData.user.unique_id === '' ? UserInfoData.user.unique_id : UserInfoData.user.unique_id,
        fans: count(UserInfoData.user.follower_count),
        total_favorited: count(UserInfoData.user.total_favorited),
        following_count: count(UserInfoData.user.following_count)
      })
    }
  }
  
  if (list['bilibili']) {
    for (const item of list['bilibili']) {
      const userInfo = await new Bilidata('用户名片信息').GetData({ host_mid: item.host_mid })
      transformedData.push({
        avatar_img: userInfo.data.card.face,
        username: userInfo.data.card.name,
        host_mid: userInfo.data.card.mid,
        fans: count(userInfo.data.follower),
        total_favorited: count(userInfo.data.like_num),
        following_count: count(userInfo.data.card.attention)
      })
    }
  }

  const img = await Render.render(
    list['douyin'] ? 'douyin/userlist' : 'bilibili/userlist',
    transformedData
  )
  return img
}

/**
 * 将数字转换为带单位的字符串
 * @param {number} num - 需要转换的数字
 * @returns {string} 转换后的字符串，超过10000则显示"xx万"，否则直接返回数字字符串
 */
const count = (num) => {
  if (num > 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  return num.toString()
}

function convertTimestampToDateTime (timestamp) {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const groupName = async (e, group_list) => {
  const group_name_list = []
  try {
    for (const gid of group_list) {
      try {
        group_name_list.push(String(e.bot?.pickGroup(Number(gid.split(':')[0])).info.group_name))
      } catch {
        group_name_list.push((await e.bot?.GetGroupInfo(gid.split(':')[0]))?.group_name)
      }
    }
  } catch {
    return group_list
  }
  return group_name_list
}
