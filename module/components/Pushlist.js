import { Render, DB } from '#components'
import { Bot } from '#lib'

/**
 *
 * @param {object} e 消息对象
 * @param {array} list 推送数组
 */
export default async function Pushlist (e, list) {
  const data = {
    douyin: await DB.FindAll('douyin'),
    bilibili: await DB.FindAll('bilibili')
  }
  const transformedData = {
    douyin: [],
    bilibili: []
  }

  const platforms = ['douyin', 'bilibili']
  const uniqueIdKeyMap = {
    douyin: 'sec_uid',
    bilibili: 'host_mid'
  }

  platforms.forEach(platform => {
    for (const groupId in data[platform]) {
      const groupData = data[platform][groupId]
      for (const uniqueIdKey in groupData) {
        const item = groupData[uniqueIdKey]
        const uniqueId = item[uniqueIdKeyMap[platform]] // 使用映射的键名访问sec_uid或host_mid
        const groupName = (() => {
          try {
            return String(Bot.pickGroup(Number(groupId)).info.group_name)
          } catch {
            return String(groupId)
          }
        })()

        const foundItem = transformedData[platform].find(
          x =>
            x.remark === item.remark && x[uniqueIdKeyMap[platform]] === uniqueId
        )

        const newItem = {
          avatar_img: item.avatar_img,
          remark: item.remark,
          create_time: convertTimestampToDateTime(item.create_time),
          [uniqueIdKeyMap[platform]]: uniqueId, // 使用映射的键名设置sec_uid或host_mid
          group_id: [groupName]
        }

        if (foundItem) {
          foundItem.group_id.push(groupName)
        } else {
          transformedData[platform].push(newItem)
        }
      }
    }
  })

  const img = await Render.render(
    'html/pushlist/pushlist',
    {
      isMaster: e.isMaster,
      group_id: e.isMaster
        ? `<h1>Bot: <code>${Bot.nickname}</code>推送列表</h1>`
        : `<h1>群: <code>${Bot?.pickGroup(Number(e.group_id))?.info?.group_name} </code>推送列表</h1>`,
      length: list,
      data: transformedData
    },
    { e, scale: 1.8, retType: 'base64' }
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
