import DouyinData from '../platform/douyin/getdata.js'
import Bilidata from '../platform/bilibili/getdata.js'
import Render from '../utils/Render.js'
import Base from '../utils/Base.js'

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
        total_favorited: count(UserInfoData.user.total_favorited)
      })
    }
  }
  
  if (list['bilibili']) {
    for (const item of list['bilibili']) {
      const DynamicList = await new Bilidata('获取用户空间动态').GetData({ host_mid: item.host_mid })
      // 过滤置顶
      let NoTopIndex = 0
      while (DynamicList.data.items[NoTopIndex]?.modules?.module_tag?.text === '置顶') {
        NoTopIndex++
      }
      transformedData.push({
        host_mid: DynamicList.data.items[NoTopIndex].modules.module_author.mid,
        remark: DynamicList.data.items[NoTopIndex].modules.module_author.name,
        avatar_img: DynamicList.data.items[NoTopIndex].modules.module_author.face,
        create_time: convertTimestampToDateTime(DynamicList.data.items[NoTopIndex].modules.module_author.pub_ts),
        group_id: await groupName(e, item.group_id)
      })
    }
  }

  if(transformedData.length === 0) return e.reply('没有找到任何数据')

  const img = await Render.render(
    list['douyin'] ? 'douyin/userlist' : 'bilibili/userlist',
    transformedData
  )
  return img
}

const count = await new Base().count()

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
