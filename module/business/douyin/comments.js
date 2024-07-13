import { DouyinData } from '#douyin'
/**
 *
 * @param {*} data 完整的评论数据
 * @param {*} emojidata 处理过后的emoji列表
 * @returns obj
 */
export default async function comments (data, emojidata) {
  const jsonArray = []
  if (data.comments === null) return []

  for (let i = 0; i < data.comments.length; i++) {
    const cid = data.comments[i].cid
    const aweme_id = data.comments[i].aweme_id
    const nickname = data.comments[i].user.nickname
    const userimageurl = data.comments[i].user.avatar_larger.url_list[0]
    const text = data.comments[i].text
    const ip = data.comments[i].ip_label ? data.comments[i].ip_label : '未知'
    const time = data.comments[i].create_time
    const label_type = data.comments[i].label_type ? data.comments[i].label_type : -1
    const sticker = data.comments[i].sticker ? data.comments[i].sticker.animate_url.url_list[0] : null
    const digg_count = data.comments[i].digg_count
    const imageurl =
      data.comments[i].image_list &&
        data.comments[i].image_list[0] &&
        data.comments[i].image_list[0].origin_url &&
        data.comments[i].image_list[0].origin_url.url_list
        ? data.comments[i].image_list[0].origin_url.url_list[0]
        : null
    const status_label = data.comments[i].label_list ? data.comments[i].label_list[0].text : null
    const userintextlongid =
      data.comments[i].text_extra && data.comments[i].text_extra[0] && data.comments[i].text_extra[0].sec_uid
        ? data.comments[i].text_extra[0].sec_uid && data.comments[i].text_extra.map((extra) => extra.sec_uid)
        : null
    const search_text =
      data.comments[i].text_extra && data.comments[i].text_extra[0] && data.comments[i].text_extra[0].search_text
        ? data.comments[i].text_extra[0].search_text &&
        data.comments[i].text_extra.map((extra) => ({
          search_text: extra.search_text,
          search_query_id: extra.search_query_id
        }))
        : null
    const relativeTime = await getRelativeTimeFromTimestamp(time)
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
  const indexLabelTypeOne = jsonArray.findIndex((comment) => comment.label_type === 1)

  if (indexLabelTypeOne !== -1) {
    const commentTypeOne = jsonArray.splice(indexLabelTypeOne, 1)[0]
    jsonArray.unshift(commentTypeOne)
  }

  /** 二级评论 咕咕咕 */
  const CommentReplyData = await new DouyinData('CommentReplyData').GetData({
    cid: jsonArray[0].cid,
    id: jsonArray[0].aweme_id
  })

  jsonArray.text = await br(jsonArray)
  jsonArray.text = await handling_at(jsonArray)
  jsonArray.text = await search_text(jsonArray)

  const CommentReplyDataArray = []
  try {
    for (let i = 0; i < CommentReplyData.comments.length; i++) {
      const nickname = CommentReplyData.comments[i].user.nickname
      const userimageurl = CommentReplyData.comments[i].user.avatar_larger.url_list[0]
      const text = CommentReplyData.comments[i].text
      const ip = CommentReplyData.comments[i].ip_label
      const time = CommentReplyData.comments[i].create_time
      const digg_count = CommentReplyData.comments[i].digg_count
      const imageurl =
        CommentReplyData.comments[i].image_list &&
          CommentReplyData.comments[i].image_list[0] &&
          CommentReplyData.comments[i].image_list[0].origin_url &&
          CommentReplyData.comments[i].image_list[0].origin_url.url_list
          ? CommentReplyData.comments[i].image_list[0].origin_url.url_list[0]
          : null
      const relativeTime = await getRelativeTimeFromTimestamp(time)

      const commentreplyObj = {
        id: i + 1,
        nickname,
        userimageurl,
        text,
        digg_count,
        ip_label: ip,
        create_time: relativeTime,
        commentimage: imageurl
      }

      CommentReplyDataArray.push(commentreplyObj)
    }
  } catch (error) {
    CommentReplyDataArray.push({ commentreplyObj: null })
  }

  const CommentData = {
    jsonArray,
    CommentReplyData: CommentReplyDataArray
  }

  for (let i = 0; i < jsonArray.length; i++) {
    if (jsonArray[i].digg_count > 10000) {
      jsonArray[i].digg_count = (jsonArray[i].digg_count / 10000).toFixed(1) + 'w'
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

async function getRelativeTimeFromTimestamp (timestamp) {
  const now = Math.floor(Date.now() / 1000) // 当前时间的时间戳
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
    // 三个月的秒数
    return Math.floor(differenceInSeconds / 2592000) + '个月前'
  } else {
    const date = new Date(timestamp * 1000) // 将时间戳转换为毫秒
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return year + '-' + month + '-' + day
  }
}

async function handling_at (data) {
  for (const item of data) {
    if (item.is_At_user_id !== null && Array.isArray(item.is_At_user_id)) {
      for (const secUid of item.is_At_user_id) {
        const UserInfoData = await new DouyinData('UserInfoData').GetData({
          user_id: secUid
        })
        if (UserInfoData.user.sec_uid === secUid) {
          /** 这里评论只要生成了艾特，如果艾特的人改了昵称，评论也不会变，所以可能会出现有些艾特没有正确上颜色，因为接口没有提供历史昵称 */
          // eslint-disable-next-line no-useless-escape
          const regex = new RegExp(`@${UserInfoData.user.nickname.replace(/[-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')}`, 'g')
          item.text = item.text.replace(regex, (match) => {
            return `<span style="color: rgb(3,72,141);">${match}</span>`
          })
        }
      }
    }
  }
}

async function search_text (data) {
  for (const item of data) {
    if (item.search_text !== null && Array.isArray(item.search_text)) {
      for (const search_text of item.search_text) {
        const SuggestWordsData = await new DouyinData('SuggestWords').GetData({
          query: search_text.search_text
        })
        if (
          SuggestWordsData.data &&
          SuggestWordsData.data[0] &&
          SuggestWordsData.data[0].params &&
          SuggestWordsData.data[0].params.query_id &&
          SuggestWordsData.data[0].params.query_id === search_text.search_query_id
        ) {
          const regex = new RegExp(`${search_text.search_text}`, 'g')
          item.text = item.text.replace(regex, (match) => {
            return `<span style="color: rgb(3,72,141); position: relative; display: inline-block;">
        ${match}
        <sup style="position: absolute; top: 0em; right: -0.65em;">
            <svg style="fill: rgb(3,72,141); width: 30px; height: 30px;" xmlns="http://www.w3.org/2000/svg" class="F12FH4eE" viewBox="0 0 9 9">
                <path clip-rule="evenodd" d="M1.2 4.024c0-1.375 1.05-2.426 2.426-2.426 1.217 0 2.269 1.051 2.269 2.426 0 1.218-1.051 2.269-2.27 2.269-1.374 0-2.425-1.051-2.425-2.269zM3.626.398C1.588.398 0 1.987 0 4.024 0 5.96 1.645 7.493 3.626 7.493c.729 0 1.414-.239 1.98-.64l1.57 1.57a.6.6 0 00.848-.85l-1.57-1.57c.402-.565.64-1.25.64-1.979 0-1.98-1.533-3.626-3.468-3.626z"></path>
            </svg>
        </sup>
    </span>&nbsp&nbsp;`
          })
        }
      }
    }
  }
}

async function br (data) {
  for (let i = 0; i < data.length; i++) {
    let text = data[i].text

    text = text.replace(/\n/g, '<br>')
    data[i].text = text
  }
  return data
}
