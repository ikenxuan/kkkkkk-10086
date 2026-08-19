import { DouyinPushPreview } from '@/module/platform/douyin/pushPreview'
import { Config, wrapWithErrorHandler } from '@/module/utils/index'
import type { CommandEvent } from '@/types/message'

const HELP = [
  '支持的命令：',
  '#测试抖音作品推送 <作品链接>',
  '#测试抖音直播状态推送 <用户主页或直播间链接>',
  '#测试抖音喜欢列表推送 <用户主页链接>',
  '#测试抖音推荐列表推送 <用户主页链接>'
].join('\n')

export class kkkTestPush extends plugin {
  constructor () {
    super({
      name: 'kkkkkk-10086-测试推送',
      dsc: '测试推送',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: /^#测试抖音(作品|喜欢列表|推荐列表|直播状态)推送/,
          fnc: 'testDouyinPush',
          permission: 'master'
        }
      ]
    })
  }

  async testDouyinPush (e: CommandEvent): Promise<boolean> {
    // wrapWithErrorHandler 会把这里传入的同一个事件对象回传给业务函数，直接闭包引用即可
    const handler = wrapWithErrorHandler(() => this.handleDouyinPush(e), { businessName: '测试抖音推送' })
    return await handler(e)
  }

  async handleDouyinPush (e: CommandEvent): Promise<boolean> {
    if (!Config.douyin?.douyintool) {
      await e.reply!('抖音解析开关未开启')
      return true
    }

    const match = e.msg.match(/^#测试抖音(作品|喜欢列表|推荐列表|直播状态)推送/)
    if (!match) {
      await e.reply!(HELP)
      return true
    }

    const pushType = match[1]
    const url = e.msg.replace(match[0], '').trim().match(/https?:\/\/[^\s]+/i)?.[0]
    if (!url) {
      await e.reply!(`请在命令后提供对应的${pushType === '作品' ? '作品' : '用户主页'}链接`)
      return true
    }

    const preview = new DouyinPushPreview(e)
    const result = pushType === '作品'
      ? await preview.renderWork(url)
      : pushType === '直播状态'
        ? await preview.renderLive(url)
        : await preview.renderList(pushType === '喜欢列表' ? 'favorite' : 'recommend', url)
    if (!result.ok) {
      await e.reply!(result.message)
      return true
    }

    await e.reply!(result.image)
    logger.mark(`[测试抖音推送] ${pushType}推送渲染完成`)
    return true
  }
}
