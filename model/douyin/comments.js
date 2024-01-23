/**
 *
 * @param {*} data 完整的评论数据
 * @param {*} emojidata 处理过后的emoji列表
 * @returns obj
 */
export async function comments(data, emojidata) {
  let jsonArray = [];

  for (let i = 0; i < data.comments.length; i++) {
    const nickname = data.comments[i].user.nickname;
    const userimageurl = data.comments[i].user.avatar_larger.url_list[0];
    const text = data.comments[i].text;
    const ip = data.comments[i].ip_label;
    const time = data.comments[i].create_time;
    let digg_count = data.comments[i].digg_count;
    const relativeTime = await getRelativeTimeFromTimestamp(time);

    const commentObj = {
      id: i + 1,
      nickname: nickname,
      userimageurl: userimageurl,
      text: text,
      digg_count: digg_count,
      ip_label: ip,
      create_time: relativeTime,
    };
    jsonArray.push(commentObj);
  }

  jsonArray.sort((a, b) => b.digg_count - a.digg_count);

  for (let i = 0; i < jsonArray.length; i++) {
    if (jsonArray[i].digg_count > 10000) {
      jsonArray[i].digg_count =
        (jsonArray[i].digg_count / 10000).toFixed(1) + "w";
    }
  }


  for (const item1 of jsonArray) {
    // 遍历emojidata中的每个元素
    for (const item2 of emojidata) {
      // 如果jsonArray中的text包含在emojidata中的name中
      if (item1.text.includes(item2.name)) {
        // 检查是否存在中括号
        if (item1.text.includes("[") && item1.text.includes("]")) {
          item1.text = item1.text
            .replace(/\[[^\]]*\]/g, `<img src="${item2.url}"/>`)
            .replace(/\\/g, "")
        } else {
          item1.text = `<img src="${item2.url}"/>`
        }
        item1.text += `&#160`
      }
    }
  }
  return jsonArray;
}

async function getRelativeTimeFromTimestamp(timestamp) {
  const now = Math.floor(Date.now() / 1000); // 当前时间的时间戳
  const differenceInSeconds = now - timestamp;

  if (differenceInSeconds < 60) {
    return differenceInSeconds + "秒前";
  } else if (differenceInSeconds < 3600) {
    return Math.floor(differenceInSeconds / 60) + "分钟前";
  } else if (differenceInSeconds < 86400) {
    return Math.floor(differenceInSeconds / 3600) + "个小时前";
  } else if (differenceInSeconds < 2592000) {
    return Math.floor(differenceInSeconds / 86400) + "天前";
  } else if (differenceInSeconds < 31536000) {
    return Math.floor(differenceInSeconds / 2592000) + "个月前";
  } else {
    return "更久之前";
  }
}