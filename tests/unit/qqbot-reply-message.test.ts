import { describe, expect, it, vi } from 'vitest'

/**
 * QQBot 的引用解析。
 *
 * 形状照抄真机：`msg_elements` 是 QQ 原始 payload 的透传（适配器只做
 * `event.msg_elements || []`），元素**没有 `type` 字段**，所以只能按 content /
 * attachments 的形状判。前两条是线上抓的实样，后面几条来自适配器作者的
 * `msg_elements.md`。
 *
 * 这条分支存在的理由：QQBot 不提供 `getMsg` / `getChatHistory` / `sendApi`，
 * 宿主因此永远造不出 `e.getReply`，`getReplyMessage` 原有的三条分支一条都进不去。
 */
vi.stubGlobal('logger', {
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), mark: vi.fn()
})

// 二维码里放什么不是这里要验的，要验的是「有没有走到扫码这一步」
vi.mock('@ikenxuan/qrcode', () => ({
  scan: vi.fn(async () => 'https://v.douyin.com/qr-code-link/')
}))
vi.mock('../../src/module/utils/Base.js', () => ({
  Base: class Base {
    get botadapter (): string { return 'QQBot' }
  }
}))
vi.mock('../../src/module/utils/Config.js', () => ({
  default: { app: { removeCache: false, Theme: 0 } }
}))
vi.mock('../../src/module/utils/Network/index.js', () => ({
  Networks: class Networks {
    async getData (): Promise<Buffer> { return Buffer.from('image-bytes') }
  }
}))
vi.mock('../../src/module/utils/Version.js', () => ({
  default: { clientPath: process.cwd(), pluginName: 'kkkkkk-10086' }
}))

const { default: Common } = await import('../../src/module/utils/Common.js')

/** `#解析` 本身留在 msg 里：取不到引用内容时它就是 getReplyMessage 的返回值 */
const eventWith = (msgElements: unknown): never => ({
  msg: '#解析',
  message: [{ type: 'text', text: '#解析' }],
  msg_elements: msgElements
}) as never

describe('QQBot 引用解析', () => {
  it('从纯文本引用里取出整段原文', async () => {
    // 真机实样：整条分享文案连着链接一起下发
    const content = '3.35 tEh:/ 04/02 :1pm H@V.Lw 复制打开抖音极速版，看看【磊哥游戏的作品】兵线全被卡住了   https://v.douyin.com/0sB8NJsBCIg/'

    await expect(Common.getReplyMessage(eventWith([
      { content, message_type: 103, msg_idx: 'REFIDX_text' }
    ]))).resolves.toBe(content)
  })

  it('机器人自己发的图是 content 里的 markdown，要走到扫码', async () => {
    // 真机实样：没有 attachments，图片以 `![...](url)` 的形式待在 content 里
    await expect(Common.getReplyMessage(eventWith([
      {
        content: '![图片 #1440px #3258px](https://qqbot.ugcimg.cn/1905261118/abcdef/012345)',
        message_type: 103,
        msg_idx: 'REFIDX_markdown'
      }
    ]))).resolves.toBe('https://v.douyin.com/qr-code-link/')
  })

  it('faceType 标记不挡住同一元素里的 attachments 图片', async () => {
    // msg_elements.md 案例 3「图片表情包」：content 与 attachments 并存。
    // extractMessageText 命中第一个非空结果就返回，而 faceType 标记是非空字符串 ——
    // 不跳过它的话这种元素永远落不到图片上。
    await expect(Common.getReplyMessage(eventWith([
      {
        content: '<faceType=6,faceId="0",ext="eyJ0ZXh0IjoiIn0=">',
        attachments: [
          { content_type: 'image/jpeg', url: 'https://multimedia.nt.qq.com.cn/download?fileid=1', width: 1242, height: 1178 }
        ],
        msg_idx: 'REFIDX_sticker'
      }
    ]))).resolves.toBe('https://v.douyin.com/qr-code-link/')
  })

  it('语音、视频、文件的 attachments 不当图片扫', async () => {
    // 扫二维码对它们没有意义，取了就是白下载一遍
    for (const contentType of ['voice', 'video/mp4', 'file']) {
      await expect(Common.getReplyMessage(eventWith([
        { content: '', attachments: [{ content_type: contentType, url: 'https://multimedia.nt.qq.com.cn/download?fileid=2' }] }
      ]))).resolves.toBe('#解析')
    }
  })

  it('ark 卡片（图文H5）的链接在 content 的 jump_url 行里', async () => {
    // 真机实样：ark_data.fields.jump_url 同时被适配器摊进 content 的多行文本
    const content = [
      '[卡片消息] 图文H5',
      '摘要: [分享]原来是被同一个女人勾了',
      'tag: 小红书',
      'title: 原来是被同一个女人勾了',
      'desc: #崩坏星穹铁道 #星穹铁道二相乐园',
      'jump_url: https://www.xiaohongshu.com/discovery/item/6a8ae4e70000000018018a7c?xsec_source=app_share&type=video'
    ].join('\n')

    const result = await Common.getReplyMessage(eventWith([
      {
        ark_data: {
          ark_name: '图文H5',
          ark_type: 'tuwen',
          fields: { tag: '小红书', title: '原来是被同一个女人勾了', jump_url: 'https://www.xiaohongshu.com/discovery/item/6a8ae4e70000000018018a7c' }
        },
        content,
        message_type: 103,
        msg_idx: 'REFIDX_ark_tuwen'
      }
    ]))

    // 整段原文交出去就够：下游 findPlatformConfig 与 getXiaohongshuID 都是在文本里找链接
    expect(result).toContain('xiaohongshu.com/discovery/item/6a8ae4e70000000018018a7c')
  })

  it('ark 卡片（小程序）里压根没有链接，只能原样交出去', async () => {
    // 真机实样：fields 只有 preview / source / source_logo / title，没有 jump_url。
    // QQ 不下发原始跳转地址，所以这种卡片解析不了 —— 交出文本让上层给出提示，
    // 而不是让它看起来像「解析成功但没反应」。
    const content = [
      '[卡片消息] 小程序',
      '摘要: [QQ小程序]【JOJO】晚安大小姐',
      'title: 【JOJO】晚安大小姐',
      'source: 哔哩哔哩'
    ].join('\n')

    const result = await Common.getReplyMessage(eventWith([
      {
        ark_data: { ark_name: '小程序', ark_type: 'miniapp', fields: { source: '哔哩哔哩', title: '【JOJO】晚安大小姐' } },
        content,
        message_type: 103,
        msg_idx: 'REFIDX_ark_miniapp'
      }
    ]))

    expect(result).toBe(content)
    // 「哔哩哔哩」是中文台名，不是 bilibili.com / BV 号，认不出来才是对的
    expect(result).not.toMatch(/bilibili\.com|b23\.tv|BV[1-9a-zA-Z]{10}/)
  })

  it('msg_elements 缺失或为空时原样返回，不影响其它入口', async () => {
    await expect(Common.getReplyMessage(eventWith(undefined))).resolves.toBe('#解析')
    await expect(Common.getReplyMessage(eventWith([]))).resolves.toBe('#解析')
  })
})
