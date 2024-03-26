import { base, BiLiBiLiAPI, networks, TikHub } from '../common.js'

export default class BiLiBiLi extends base {
  async GetData(bvid) {
    const INFODATA = await new networks({ url: await BiLiBiLiAPI.INFO(bvid) }).getData()
    const DATA = await new networks({ url: await BiLiBiLiAPI.VIDEO(INFODATA.data.aid, INFODATA.data.cid) }).getData()
    return { INFODATA, DATA }
  }

  async RESOURCES(OBJECT) {
    const 简介 = OBJECT.INFODATA.data.desc
    const up名字 = OBJECT.INFODATA.data.owner.name
    const up头像 = OBJECT.INFODATA.data.owner.face
    const 封面 = OBJECT.INFODATA.data.pic
    const 标题 = OBJECT.INFODATA.data.title
    const 硬币 = await this.count(OBJECT.INFODATA.data.stat.coin)
    const 点赞 = await this.count(OBJECT.INFODATA.data.stat.like)
    const 转发 = await this.count(OBJECT.INFODATA.data.stat.share)
    const 播放量 = await this.count(OBJECT.INFODATA.data.stat.view)
    const 收藏 = await this.count(OBJECT.INFODATA.data.stat.favorite)
    const 弹幕 = await this.count(OBJECT.INFODATA.data.stat.danmaku)
    const 视频地址 = OBJECT.DATA.data.durl[0].url
    await this.e.reply([
      segment.image(封面),
      `标题: ${标题}\n\n作者: ${up名字}\n播放量: ${播放量},    弹幕: ${弹幕}\n点赞: ${点赞},    投币: ${硬币}\n转发: ${转发},    收藏: ${收藏}`,
    ])
    await new TikHub(this.e).DownLoadVideo(视频地址, 标题)
  }

  /** 过万整除 */
  async count(count) {
    if (count > 10000) {
      return (count / 10000).toFixed(1) + '万'
    } else {
      return count.toString()
    }
  }
}
