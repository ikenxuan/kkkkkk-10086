import Argument from "./getdata.js";
// import fs from "fs";
/**
 *
 * @param {*} data 完整的评论数据
 * @param {*} emojidata 处理过后的emoji列表
 * @returns obj
 */
export async function comments(data, emojidata) {
  // fs.writeFileSync("comments.json", JSON.stringify(data, null, 4));
  let jsonArray = [];

  for (let i = 0; i < data.comments.length; i++) {
    const cid = data.comments[i].cid;
    const aweme_id = data.comments[i].aweme_id;
    const nickname = data.comments[i].user.nickname;
    const userimageurl = data.comments[i].user.avatar_larger.url_list[0];
    const text = data.comments[i].text;
    const ip = data.comments[i].ip_label ? data.comments[i].ip_label : "未知";
    const time = data.comments[i].create_time;
    const label_type = data.comments[i].label_type
      ? data.comments[i].label_type
      : -1;
    const sticker = data.comments[i].sticker
      ? data.comments[i].sticker.animate_url.url_list[0]
      : null;
    let digg_count = data.comments[i].digg_count;
    const imageurl =
      data.comments[i].image_list &&
      data.comments[i].image_list[0] &&
      data.comments[i].image_list[0].origin_url &&
      data.comments[i].image_list[0].origin_url.url_list
        ? data.comments[i].image_list[0].origin_url.url_list[0]
        : null;
    const status_label = data.comments[i].label_list ? data.comments[i].label_list[0].text : null
    const relativeTime = await getRelativeTimeFromTimestamp(time);
    const commentObj = {
      id: i + 1,
      cid: cid,
      aweme_id: aweme_id,
      nickname: nickname,
      userimageurl: userimageurl,
      text: text,
      digg_count: digg_count,
      ip_label: ip,
      create_time: relativeTime,
      commentimage: imageurl,
      label_type: label_type,
      sticker: sticker,
      status_label: status_label
    };
    jsonArray.push(commentObj);
  }

  jsonArray.sort((a, b) => b.digg_count - a.digg_count);
  const indexLabelTypeOne = jsonArray.findIndex(
    (comment) => comment.label_type === 1
  );

  if (indexLabelTypeOne !== -1) {
    const commentTypeOne = jsonArray.splice(indexLabelTypeOne, 1)[0];
    jsonArray.unshift(commentTypeOne);
  }

  const CommentReplyData = await new Argument().GetData({
    type: "CommentReplyData",
    cid: jsonArray[0].cid,
    id: jsonArray[0].aweme_id,
  });

  let CommentReplyDataArray = [];
  try {
    for (let i = 0; i < CommentReplyData.comments.length; i++) {
      const nickname = CommentReplyData.comments[i].user.nickname;
      const userimageurl =
        CommentReplyData.comments[i].user.avatar_larger.url_list[0];
      const text = CommentReplyData.comments[i].text;
      const ip = CommentReplyData.comments[i].ip_label;
      const time = CommentReplyData.comments[i].create_time;
      let digg_count = CommentReplyData.comments[i].digg_count;
      const imageurl =
        CommentReplyData.comments[i].image_list &&
        CommentReplyData.comments[i].image_list[0] &&
        CommentReplyData.comments[i].image_list[0].origin_url &&
        CommentReplyData.comments[i].image_list[0].origin_url.url_list
          ? CommentReplyData.comments[i].image_list[0].origin_url.url_list[0]
          : null;
      const relativeTime = await getRelativeTimeFromTimestamp(time);

      const commentreplyObj = {
        id: i + 1,
        nickname: nickname,
        userimageurl: userimageurl,
        text: text,
        digg_count: digg_count,
        ip_label: ip,
        create_time: relativeTime,
        commentimage: imageurl,
      };

      CommentReplyDataArray.push(commentreplyObj);
    }
  } catch (error) {
    CommentReplyDataArray.push({ commentreplyObj: null });
  }

  let CommentData = {
    jsonArray: jsonArray,
    CommentReplyData: CommentReplyDataArray,
  };

  for (let i = 0; i < jsonArray.length; i++) {
    if (jsonArray[i].digg_count > 10000) {
      jsonArray[i].digg_count =
        (jsonArray[i].digg_count / 10000).toFixed(1) + "w";
    }
  }

  for (const item1 of CommentData.jsonArray) {
    // 遍历emojidata中的每个元素
    for (const item2 of emojidata) {
      // 如果jsonArray中的text包含在emojidata中的name中
      if (item1.text.includes(item2.name)) {
        // 检查是否存在中括号
        if (item1.text.includes("[") && item1.text.includes("]")) {
          item1.text = item1.text
            .replace(/\[[^\]]*\]/g, `<img src="${item2.url}"/>`)
            .replace(/\\/g, "");
        } else {
          item1.text = `<img src="${item2.url}"/>`;
        }
        item1.text += `&#160`;
      }
    }
  }
  // fs.writeFileSync("res3.json", JSON.stringify(jsonArray, null, 4));
  return CommentData;
}

async function getRelativeTimeFromTimestamp(timestamp) {
  const now = Math.floor(Date.now() / 1000); // 当前时间的时间戳
  const differenceInSeconds = now - timestamp;

  if (differenceInSeconds < 30) {
      return '刚刚';
  } else if (differenceInSeconds < 60) {
      return differenceInSeconds + "秒前";
  } else if (differenceInSeconds < 3600) {
      return Math.floor(differenceInSeconds / 60) + "分钟前";
  } else if (differenceInSeconds < 86400) {
      return Math.floor(differenceInSeconds / 3600) + "个小时前";
  } else if (differenceInSeconds < 2592000) {
      return Math.floor(differenceInSeconds / 86400) + "天前";
  } else if (differenceInSeconds < 7776000) { // 三个月的秒数
      return Math.floor(differenceInSeconds / 2592000) + "个月前";
  } else {
      const date = new Date(timestamp * 1000); // 将时间戳转换为毫秒
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return year + '-' + month + '-' + day;
  }
}