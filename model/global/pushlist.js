import { Render, DB } from '#modules'

/**
 *
 * @param {Object} e 消息对象
 * @param {Array} list 推送数组
 */
export async function pushlist(e, list) {
  let img,
    data = {
      douyin: await DB.FindAll('douyin'),
      bilibili: await DB.FindAll('bilibili'),
    }
  const transformedData = {
    douyin: [],
    bilibili: [],
  }

  // 遍历douyin对象
  for (const groupId in data.douyin) {
    const groupData = data.douyin[groupId]
    for (const secUid in groupData) {
      const item = groupData[secUid]
      const groupName = (() => {
        try {
          // 尝试获取群组名称
          return String(Bot.pickGroup(groupId).info.group_name)
        } catch {
          return String(groupId)
        }
      })()
      // 寻找是否有相同的remark和sec_uid，如果有，则更新group_id数组
      let foundItem = transformedData.douyin.find((x) => x.remark === item.remark && x.sec_uid === item.sec_uid)
      if (foundItem) {
        foundItem.group_id.push(groupName)
      } else {
        // 如果没有找到，创建新的对象并添加到数组中
        transformedData.douyin.push({
          remark: item.remark,
          create_time: convertTimestampToDateTime(item.create_time),
          sec_uid: item.sec_uid,
          group_id: [groupName],
          avatar_img: item.avatar_img,
        })
      }
    }
  }

  img = await Render.render(
    'html/pushlist/pushlist',
    {
      isMaster: e.isMaster,
      group_id: e.isMaster
        ? `<h1>Bot: <code>${Bot.nickname}</code>推送列表</h1>`
        : `<h1>群: <code>${Bot.pickGroup(Number(e.group_id)).info.group_name} </code>推送列表</h1>`,
      length: list,
      data: transformedData,
    },
    { e, scale: 1.8, retType: 'base64' },
  )
  return img
}

function convertTimestampToDateTime(timestamp) {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}
