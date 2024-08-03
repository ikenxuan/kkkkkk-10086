import { Render } from '#components'
import { DouyinData } from '#douyin'
import { Bilidata } from '#bilibili'
import { Bot } from '#lib'

/**
 *
 * @param {object} e 消息对象
 * @param {array} list 推送数组
 */
export default async function Pushlist (e, list) {
  const transformedData = {
    douyin: [],
    bilibili: []
  }
  for (const item of list['douyin']) {
    const UserInfoData = await new DouyinData('UserInfoData').GetData({ user_id: item.sec_uid })
    const DynamicList = await new DouyinData('UserVideosList').GetData({ user_id: item.sec_uid })
    // 过滤置顶
    let NoTopIndex = 0
    while (DynamicList.aweme_list[NoTopIndex].is_top === 1) {
      NoTopIndex++
    }
    transformedData.douyin.push({
      sec_uid: UserInfoData.user.unique_id === '' ? UserInfoData.user.unique_id : UserInfoData.user.unique_id,
      remark: UserInfoData.user.nickname,
      avatar_img: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + UserInfoData.user.avatar_larger.uri,
      create_time: convertTimestampToDateTime(DynamicList.aweme_list[NoTopIndex].create_time),
      group_id: await groupName(e, item.group_id)
    })
  }
  for (const item of list['bilibili']) {
    const DynamicList = await new Bilidata('获取用户空间动态').GetData(item.host_mid)
    // 过滤置顶
    let NoTopIndex = 0
    while (DynamicList.data.items[NoTopIndex]?.modules?.module_tag?.text === '置顶') {
      NoTopIndex++
    }
    transformedData.bilibili.push({
      host_mid: DynamicList.data.items[NoTopIndex].modules.module_author.mid,
      remark: DynamicList.data.items[NoTopIndex].modules.module_author.name,
      avatar_img: DynamicList.data.items[NoTopIndex].modules.module_author.face,
      create_time: convertTimestampToDateTime(DynamicList.data.items[NoTopIndex].modules.module_author.pub_ts),
      group_id: await groupName(e, item.group_id)
    })
  }

  const img = await Render.render(
    'html/pushlist/pushlist',
    {
      isMaster: e.isMaster,
      group_id: e.isMaster
        ? `<h1>Bot: <code>${e.bot?.nickname || e?.bot?.account?.name}</code>推送列表</h1>`
        : `<h1>群: <code>${e.bot?.pickGroup(Number(e.group_id))?.info?.group_name || (await e?.bot?.GetGroupInfo(e.group_id))?.group_name} </code>推送列表</h1>`,
      length: list,
      data: transformedData
    },
  )
  return img
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
        group_name_list.push(String(e.bot?.pickGroup(Number(gid)).info.group_name))
      } catch {
        group_name_list.push((await e.bot?.GetGroupInfo(gid.split(':')[0]))?.group_name)
      }
    }
  } catch {
    return group_list
  }
  return group_name_list
}
