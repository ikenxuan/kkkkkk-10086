import { Common, Config, Networks } from '../../utils/index.js'
import { getDouyinData } from '@ikenxuan/amagi'
import convert from 'heic-convert'

/**
 *
 * @param {*} data 完整的评论数据
 * @param {*} emojidata 处理过后的emoji列表
 * @returns obj
 */
export async function douyinComments(data, emojidata) {
  let jsonArray = []
  if (data.comments === null) return []

  for (let i = 0; i < data.comments.length; i++) {
    const cid = data.comments[i].cid
    const aweme_id = data.comments[i].aweme_id
    const nickname = data.comments[i].user.nickname
    const userimageurl = data.comments[i].user.avatar_thumb.url_list[0]
    const text = data.comments[i].text
    const ip = data.comments[i].ip_label ?? '未知'
    const time = data.comments[i].create_time
    const label_type = data.comments[i].label_type ?? -1
    const sticker = data.comments[i].sticker ? data.comments[i].sticker.animate_url.url_list[0] : null
    const digg_count = data.comments[i].digg_count
    const imageurl =
      data.comments[i].image_list &&
        data.comments[i].image_list?.[0] &&
        data.comments[i].image_list?.[0].origin_url &&
        data.comments[i].image_list?.[0].origin_url.url_list
        ? data.comments[i].image_list?.[0].origin_url.url_list[0]
        : null
    const status_label = data.comments[i].label_list?.[0]?.text ?? null
    const userintextlongid =
      data.comments[i].text_extra && data.comments[i].text_extra[0] && data.comments[i].text_extra[0].sec_uid
        ? data.comments[i].text_extra[0].sec_uid && data.comments[i].text_extra.map(extra => extra.sec_uid)
        : null
    const search_text =
      data.comments[i].text_extra && data.comments[i].text_extra[0] && data.comments[i].text_extra[0].search_text
        ? data.comments[i].text_extra[0].search_text &&
        data.comments[i].text_extra.map(extra => ({
          search_text: extra.search_text,
          search_query_id: extra.search_query_id
        }))
        : null
    const relativeTime = getRelativeTimeFromTimestamp(time)
    const reply_comment_total = data.comments[i].reply_comment_total
    const commentObj = {
      id: i + 1,
      cid,
      aweme_id,
      nickname,
      userimageurl,
      text,
      digg_count,
      ip_label: ip,
      create_time: relativeTime,
      commentimage: imageurl,
      label_type,
      sticker,
      status_label,
      is_At_user_id: userintextlongid,
      search_text,
      reply_comment_total
    }
    jsonArray.push(commentObj)
  }

  jsonArray.sort((a, b) => b.digg_count - a.digg_count)
  const indexLabelTypeOne = jsonArray.findIndex(comment => comment.label_type === 1)

  if (indexLabelTypeOne !== -1) {
    const commentTypeOne = jsonArray.splice(indexLabelTypeOne, 1)[0]
    jsonArray.unshift(commentTypeOne)
  }

  jsonArray = br(jsonArray)
  jsonArray = await handling_at(jsonArray)
  jsonArray = await search_text(jsonArray)
  jsonArray = await heic2jpg(jsonArray)

  const CommentData = {
    jsonArray
  }

  for (const i of jsonArray) {
    if (i.digg_count > 10000) {
      i.digg_count = (i.digg_count / 10000).toFixed(1) + 'w'
    }
  }

  for (const item1 of CommentData.jsonArray) {
    // 遍历emojidata中的每个元素
    for (const item2 of emojidata) {
      // 如果jsonArray中的text包含在emojidata中的name中
      if (item1.text.includes(item2.name)) {
        // 检查是否存在中括号
        if (item1.text.includes('[') && item1.text.includes(']')) {
          item1.text = item1.text.replace(/\[[^\]]*\]/g, `<img src="${item2.url}"/>`).replace(/\\/g, '')
        } else {
          item1.text = `<img src="${item2.url}"/>`
        }
        item1.text += '&#160'
      }
    }
  }
  return CommentData
}

/**
 * 将时间戳转换为相对时间描述
 * @param {number} timestamp Unix时间戳(秒)
 * @returns {string} 相对时间描述，如"刚刚"、"30秒前"、"1小时前"等，超过3个月则返回具体日期(YYYY-MM-DD)
 */
function getRelativeTimeFromTimestamp(timestamp) {
  const now = Math.floor(Date.now() / 1000)
  const differenceInSeconds = now - timestamp

  if (differenceInSeconds < 30) {
    return '刚刚'
  } else if (differenceInSeconds < 60) {
    return differenceInSeconds + '秒前'
  } else if (differenceInSeconds < 3600) {
    return Math.floor(differenceInSeconds / 60) + '分钟前'
  } else if (differenceInSeconds < 86400) {
    return Math.floor(differenceInSeconds / 3600) + '小时前'
  } else if (differenceInSeconds < 2592000) {
    return Math.floor(differenceInSeconds / 86400) + '天前'
  } else if (differenceInSeconds < 7776000) {
    return Math.floor(differenceInSeconds / 2592000) + '个月前'
  } else {
    const date = new Date(timestamp * 1000)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return year + '-' + month + '-' + day
  }
}

/**
 * 高亮 @ 的内容
 * @param data 评论数据
 * @returns
 */
async function handling_at(data) {
  for (const item of data) {
    if (item.is_At_user_id !== null && Array.isArray(item.is_At_user_id)) {
      for (const secUid of item.is_At_user_id) {
        const UserInfoData = await getDouyinData('用户主页数据', Config.cookies.douyin, { sec_uid: secUid, typeMode: 'strict' })
        if (UserInfoData.user.sec_uid === secUid) {
          /** 这里评论只要生成了艾特，如果艾特的人改了昵称，评论也不会变，所以可能会出现有些艾特没有正确上颜色，因为接口没有提供历史昵称 */
          const regex = new RegExp(`@${UserInfoData.user.nickname?.replace(/[-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')}`, 'g')
          item.text = item.text.replace(regex, match => {
            return `<span class="${Common.useDarkTheme() ? 'dark-mode handling_at' : 'handling_at'}">${match}</span>`
          })
        }
      }
    }
  }
  return data
}

/**
 * 高亮热点搜索关键词
 * @param {Object[]} data 评论数据
 * @param {number} data[].id 评论ID
 * @param {any} data[].cid 评论唯一标识
 * @param {any} data[].aweme_id 视频ID
 * @param {any} data[].nickname 用户昵称
 * @param {any} data[].userimageurl 用户头像URL
 * @param {any} data[].text 评论文本内容
 * @param {any} data[].digg_count 点赞数
 * @param {any} data[].ip_label IP归属地
 * @param {string} data[].create_time 创建时间
 * @param {any} data[].commentimage 评论图片
 * @param {any} data[].label_type 标签类型
 * @param {any} data[].sticker 表情贴纸
 * @param {any} data[].status_label 状态标签
 * @param {any} data[].is_At_user_id 艾特用户ID
 * @param {any} data[].search_text 搜索文本
 * @param {any} data[].reply_comment_total 回复总数
 * @returns {Promise<Object[]>} 处理后的评论数据
 */
async function search_text(data) {
  for (const item of data) {
    if (item.search_text !== null && Array.isArray(item.search_text)) {
      for (const search_text of item.search_text) {
        const SuggestWordsData = await getDouyinData('热点词数据', Config.cookies.douyin, { query: search_text.search_text, typeMode: 'strict' })
        if (
          SuggestWordsData.data &&
          SuggestWordsData.data[0] &&
          SuggestWordsData.data[0].params &&
          SuggestWordsData.data[0].params.query_id &&
          SuggestWordsData.data[0].params.query_id === search_text.search_query_id
        ) {
          const regex = new RegExp(`${search_text.search_text}`, 'g')
          item.text = item.text.replace(regex, match => {
            const themeClass = Common.useDarkTheme() ? 'dark-mode' : ''
            return `<span class="search_text ${themeClass}">
                ${match}
                <span class="search-ico"></span>
            </span>&nbsp;&nbsp;&nbsp;`
          })
        }
      }
    }
  }
  return data
}

/**
 * 换行符转义为<br>
 * @param data 评论数据
 * @returns
 */
function br(data) {
  for (const i of data) {
    let text = i.text
    text = text.replace(/\n/g, '<br>')
    i.text = text
  }
  return data
}

/**
 * HEIC转JPG
 * @param jsonArray 评论数据
 * @returns
 */
const heic2jpg = async (jsonArray) => {
  for (const item of jsonArray) {
    if (item.commentimage) {
      const headers = await new Networks({ url: item.commentimage, type: 'arraybuffer' }).getHeaders()
      if (headers['content-type'] && headers['content-type'] === 'image/heic') {
        const response = await new Networks({ url: item.commentimage, type: 'arraybuffer' }).returnResult()
        const jpegBuffer = await convert({
          buffer: response.data,
          format: 'JPEG'
        })
        const base64Image = Buffer.from(jpegBuffer).toString('base64')
        item.commentimage = `data:image/jpeg;base64,${base64Image}`
      }
    }
  }
  return jsonArray
}
