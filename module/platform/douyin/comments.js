import { Common, Config, Networks, baseHeaders } from '../../utils/index.js'
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
  if (data.data.comments === null) return []

  let id = 1
  for (const comment of data.data.comments) {
    const cid = comment.cid
    const aweme_id = comment.aweme_id
    const nickname = comment.user.nickname
    const userimageurl = comment.user.avatar_thumb.url_list[0]
    const text = comment.text
    const ip = comment.ip_label ?? '未知'
    const time = comment.create_time
    const label_type = comment.label_type ?? -1
    const sticker = comment.sticker ? comment.sticker.animate_url.url_list[0] : null
    const digg_count = comment.digg_count
    const imageurl =
      comment.image_list &&
        comment.image_list?.[0] &&
        comment.image_list?.[0].origin_url &&
        comment.image_list?.[0].origin_url.url_list
        ? comment.image_list?.[0].origin_url.url_list[0]
        : null
    const status_label = comment.label_list?.[0]?.text ?? null
    const userintextlongid =
      comment.text_extra && comment.text_extra[0] && comment.text_extra[0].sec_uid
        ? comment.text_extra[0].sec_uid && comment.text_extra.map((extra) => extra.sec_uid)
        : null
    const search_text =
      comment.text_extra && comment.text_extra[0] && comment.text_extra[0].search_text
        ? comment.text_extra[0].search_text &&
        comment.text_extra.map((extra) => ({
          search_text: extra.search_text,
          search_query_id: extra.search_query_id
        }))
        : null
    const relativeTime = getRelativeTimeFromTimestamp(time)
    const reply_comment_total = comment.reply_comment_total
    const commentObj = {
      id: id++,
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
  const indexLabelTypeOne = jsonArray.findIndex((comment) => comment.label_type === 1)

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
      // 如果text中包含这个特定的emoji
      if (item1.text.includes(item2.name)) {
        item1.text = item1.text.replaceAll(item2.name, `<img src="${item2.url}"/>`)
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
        if (UserInfoData.data.user.sec_uid === secUid) {
          /** 这里评论只要生成了艾特，如果艾特的人改了昵称，评论也不会变，所以可能会出现有些艾特没有正确上颜色，因为接口没有提供历史昵称 */
          const regex = new RegExp(`@${UserInfoData.data.user.nickname?.replace(/[-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')}`, 'g')
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
          SuggestWordsData.data.data &&
          SuggestWordsData.data.data[0] &&
          SuggestWordsData.data.data[0].params &&
          SuggestWordsData.data.data[0].params.query_id &&
          SuggestWordsData.data.data[0].params.query_id === search_text.search_query_id
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
      const headers = await new Networks({ url: item.commentimage, type: 'arraybuffer', 
        headers: {
          ...baseHeaders,
          Referer: 'https://www.douyin.com/',
          Cookie: ''
        }
      }).getHeaders()
      if (headers['content-type'] && headers['content-type'] === 'image/heic') {
        const response = await new Networks({ url: item.commentimage, type: 'arraybuffer',
          headers: { 
            ...baseHeaders, 
            Referer: 'https://www.douyin.com/', 
            Cookie: '' 
          }
        }).returnResult()
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
