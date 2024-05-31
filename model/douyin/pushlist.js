import { Render } from '#modules'

/**
 *
 * @param {Object} e 消息对象
 * @param {Array} list 推送数组
 * @param {Array} redisdata redis缓存
 * @param redisdata.douyin 抖音缓存数据
 * @param redisdata.bilibili B站缓存数据
 */
export async function pushlist(e, list, redisdata) {
  let img
  const data = {
    douyin: JSON.parse(redisdata.douyin) || [],
    bilibili: JSON.parse(redisdata.bilibili) || [],
  }

  // 定义一个函数来筛选数组
  const filterArray = (arr, groupId) => {
    return arr.filter((item) => {
      // 检查群号是否存在于当前项的group_id数组中
      return item.group_id && item.group_id.includes(groupId)
    })
  }

  // 遍历data对象的所有属性
  for (let key in data) {
    if (data.hasOwnProperty(key)) {
      // 确保属性值是数组
      if (Array.isArray(data[key])) {
        if (!e.isMaster) {
          data[key] = filterArray(data[key], e.group_id)
        }
        // 遍历数组中的每个对象
        data[key].forEach((item) => {
          // 格式化
          if (item.create_time) {
            item.create_time = convertTimestampToDateTime(item.create_time)
          }
          item.group_id = item.group_id.map((groupId) => {
            try {
              return String(Bot.pickGroup(Number(groupId)).info.group_name)
            } catch {
              return groupId
            }
          })
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
        : `<h1>群: <code>${Bot.pickGroup(Number(e.group_id)).info.group_name}</code>推送列表</h1>`,
      length: list,
      data: data,
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
