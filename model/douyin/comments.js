export async function comments(data) {
    let jsonArray = [];

    for (let i = 0; i < data.comments.length; i++) {
        const nickname = data.comments[i].user.nickname
        const userimageurl = data.comments[i].user.avatar_larger.url_list[0]
        const text = data.comments[i].text
        let digg_count = data.comments[i].digg_count
        if (digg_count > 10000) {
            digg_count = (digg_count / 10000).toFixed(1) + "w"
        }

        const commentObj = {
            "nickname": nickname,
            "userimageurl": userimageurl,
            "text": text,
            "digg_count": digg_count
        };
        jsonArray.push(commentObj);
    }
    return jsonArray
}