/**
 * 「业务出错卡片」(other/handlerError) 的开发面板 mock。
 *
 * 契约用的是 `ApiErrorData`，不是同文件里的 `HandlerErrorProps` ——
 * 后者是死代码（声明处之外零引用），contracts/template-data-map.ts 把
 * 'other/handlerError' 映射到的是 ApiErrorData。照 HandlerErrorProps 写会多出
 * templateType / templateName 两个模板根本不读的字段，还缺一堆真字段。
 *
 * 关于不用 `defineMock`、以及导出名为什么带模板前缀，见 other/runtime/mock.ts 顶部的说明。
 *
 * 三个导出覆盖的是这张卡片真正会分叉的路径：
 * - errorBusinessPlain：ErrorHandler/render.ts 那条「JS 业务异常」，有真调用栈、无诊断字段
 * - errorVerificationWithDiagnostics：Base.ts 那条「接口错误」，没有 JS 调用栈、改用结构化诊断，
 *   同时带上 B站风控的人机验证二维码
 * - errorQQBotAdapter：QQBot 适配器，专盯「协议标准」那格的出字
 */
import type { ApiErrorData } from './components/types'

/**
 * 抖音解析抛出的普通业务异常。
 *
 * logs 的顺序照抄生产端：`ctx.logs.slice().reverse()` 先铺（真日志**倒序**、最新在最上），
 * 再把合成的「群:/用户:」两行追加到**末尾**。顺序反了面板上看不出问题，线上却会把
 * 上下文行插到日志中间。
 */
export const errorBusinessPlain: ApiErrorData = {
  type: 'business_error',
  platform: 'douyin',
  error: {
    name: 'TypeError',
    message: "Cannot read properties of undefined (reading 'play_addr')",
    // 生产端这里是真实 JS 调用栈；模板按 `stackText !== ''` 决定要不要渲染「失败详情」区块
    stack: [
      "TypeError: Cannot read properties of undefined (reading 'play_addr')",
      '    at DouYin.getVideoUrl (/root/Yunzai/plugins/kkkkkk-10086/lib/module/platform/douyin/douyin.js:412:38)',
      '    at DouYin.handleVideo (/root/Yunzai/plugins/kkkkkk-10086/lib/module/platform/douyin/douyin.js:268:26)',
      '    at DouYin.RESOURCES (/root/Yunzai/plugins/kkkkkk-10086/lib/module/platform/douyin/douyin.js:131:18)',
      '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
      '    at async Douyin.douyin (/root/Yunzai/plugins/kkkkkk-10086/lib/apps/douyin.js:57:5)'
    ].join('\n'),
    businessName: '抖音解析'
  },
  method: '抖音解析',
  // 生产端是 new Date().toISOString()，这一格模板自己格式化，别提前排版
  timestamp: '2026-08-25T14:23:41.882Z',
  logs: [
    { timestamp: '22:23:41.880', level: 'ERRO', message: '[抖音] 视频地址解析失败，接口返回结构与预期不符', raw: '[22:23:41.880][ERRO] [抖音] 视频地址解析失败，接口返回结构与预期不符' },
    { timestamp: '22:23:41.417', level: 'WARN', message: '[抖音] aweme_detail.video 缺少 play_addr 字段，可能命中了图文作品', raw: '[22:23:41.417][WARN] [抖音] aweme_detail.video 缺少 play_addr 字段，可能命中了图文作品' },
    { timestamp: '22:23:40.964', level: 'INFO', message: '[抖音] 接口返回 status_code=0，aweme_id=7398452137894563074', raw: '[22:23:40.964][INFO] [抖音] 接口返回 status_code=0，aweme_id=7398452137894563074' },
    { timestamp: '22:23:40.213', level: 'INFO', message: '[抖音] 开始请求作品详情接口', raw: '[22:23:40.213][INFO] [抖音] 开始请求作品详情接口' },
    { timestamp: '22:23:39.876', level: 'MARK', message: '[抖音] 识别到短链 https://v.douyin.com/iQ8kTfBz/', raw: '[22:23:39.876][MARK] [抖音] 识别到短链 https://v.douyin.com/iQ8kTfBz/' },
    // 「群:/用户:」是 buildContextLogEntries 合成的条目，不是真日志行，没有发生时刻，
    // 所以 timestamp 刻意留空串 —— 模板那边是 `log.timestamp ? <legend> : null`，
    // 空串正好走「不渲染时间胶囊」这条分支。填一个假时间会在图上凭空多出两个时间戳。
    { timestamp: '', level: 'INFO', message: '群: 114514', raw: '群: 114514' },
    { timestamp: '', level: 'INFO', message: '用户: 1919810', raw: '用户: 1919810' }
  ],
  triggerCommand: 'https://v.douyin.com/iQ8kTfBz/',
  frameworkVersion: '3.1.6',
  pluginVersion: '2.39.3',
  // 已经是 formatBuildTime 的产物；模板还要用 `yyyy年MM月dd日 HH:mm` 反解出「多久以前」，
  // 换 ISO 会解析失败，那半句相对时间静默消失
  buildTime: '2026年08月25日 21:40',
  commitHash: '77e7636',
  adapterInfo: {
    // 取协议端真名而不是平台名，长度不受控，这一格是 break-all 不裁字
    name: 'LLOneBot',
    version: '8.1.8',
    platform: 'QQ',
    protocol: 'llonebot',
    standard: 'onebot11',
    // communication 不在 AdapterInfo 的显式字段里，靠 `[key: string]: unknown` 索引签名合法，
    // 但模板 handlerError.tsx 确实读它（Communication / 通信方式 那一格）。
    // 漏了这格会印出 "undefined"，而 TS 一声不响 —— 索引签名不会报缺字段。
    communication: 'webSocketServer'
  }
}

/**
 * B站风控：接口类错误 + 人机验证二维码。
 *
 * `stack` 刻意给空串：这条路径（Base.ts 的 buildApiErrorImage）拿到的是接口返回的错误码，
 * 压根没有 JS 调用栈，所以改用 `error.diagnostics` 的键值对呈现。
 * 模板的 `hasFailureDetail = stackText !== '' || diagnostics.length > 0` 正是为这个场景写的 ——
 * 给 stack 编一段假堆栈就把这条分支盖掉了，诊断区块永远测不到。
 */
export const errorVerificationWithDiagnostics: ApiErrorData = {
  type: 'business_error',
  platform: 'bilibili',
  error: {
    name: '-352',
    message: '请求被风控拦截，需要完成人机验证',
    stack: '',
    businessName: 'B站解析',
    // label / value 与 Base.ts 的 collectApiDiagnostics 一一对应，
    // 且该函数会 filter 掉空值，所以这里不留空字符串项
    diagnostics: [
      { label: '平台', value: 'bilibili' },
      { label: '接口', value: '视频详情' },
      { label: '业务码', value: '-352' },
      { label: '请求类型', value: 'GET' },
      { label: '错误描述', value: '风控校验失败，请完成验证后重试' },
      { label: '接口地址', value: 'https://api.bilibili.com/x/web-interface/wbi/view?bvid=BV1Gx411A7Nz' }
    ]
  },
  method: 'B站解析',
  timestamp: '2026-08-25T14:31:07.204Z',
  logs: [
    { timestamp: '22:31:07.201', level: 'ERRO', message: '[B站] 接口返回 code=-352，进入风控验证流程', raw: '[22:31:07.201][ERRO] [B站] 接口返回 code=-352，进入风控验证流程' },
    { timestamp: '22:31:06.885', level: 'WARN', message: '[B站] 已申请极验挑战，gt=ac597a4506fc1ac0e0a1e5e9a4c3e1b2', raw: '[22:31:06.885][WARN] [B站] 已申请极验挑战，gt=ac597a4506fc1ac0e0a1e5e9a4c3e1b2' },
    { timestamp: '22:31:06.342', level: 'INFO', message: '[B站] SESSDATA 有效，正在请求 wbi 签名接口', raw: '[22:31:06.342][INFO] [B站] SESSDATA 有效，正在请求 wbi 签名接口' },
    { timestamp: '22:31:05.918', level: 'MARK', message: '[B站] 识别到 BV1Gx411A7Nz', raw: '[22:31:05.918][MARK] [B站] 识别到 BV1Gx411A7Nz' },
    // 主动推送场景连事件对象都没有，这里是群聊触发，两行都在（同上，timestamp 为空串）
    { timestamp: '', level: 'INFO', message: '群: 233666888', raw: '群: 233666888' },
    { timestamp: '', level: 'INFO', message: '用户: 1919810', raw: '用户: 1919810' }
  ],
  triggerCommand: 'https://www.bilibili.com/video/BV1Gx411A7Nz',
  frameworkVersion: '3.1.6',
  pluginVersion: '2.39.3',
  buildTime: '2026年08月25日 21:40',
  commitHash: '77e7636',
  adapterInfo: {
    // Milky：name 命中 Milky.png 主 logo，standard 又会在「协议标准」那格叠一层水印，
    // 一个适配器同时点到两处视觉分支
    name: 'Milky',
    version: '0.1.0',
    platform: 'QQ',
    protocol: 'milky',
    standard: 'milky',
    communication: 'webSocketClient'
  },
  isVerification: true,
  // 二维码那块的门是 `isVerification && verificationUrl`，两个都得给。
  // URL 形状照抄 riskControl.ts:156，极验的 gt / challenge 都是 32 位 hex
  verificationUrl: 'https://karin-plugin-kkk-docs.vercel.app/geetest?v=3&gt=ac597a4506fc1ac0e0a1e5e9a4c3e1b2&challenge=7f3c9d18b25e4a6f80d1c2b3a4958607'
}

/**
 * QQBot（官方 Bot 开放平台）适配器下的错误卡。
 *
 * 存在意义是盯「协议标准」那格的出字：`standard` 存的是小写 `qqbot`（角标判定
 * `includes('onebot')` 大小写敏感，不能为了好看改它），模板的 `formatStandard`
 * 负责查表出 `QQBot`。这里曾经渲染成 `Qqbot` —— `_.upperFirst(_.camelCase('qqbot'))`
 * 把品牌名里的连续大写压掉了，卡片上大小写不一。
 *
 * QQBot 走官方 API，不属于任何 OneBot 标准，所以三格互不相同：
 * platform=QQBot（对接平台）、standard=qqbot（协议标准）、protocol=qqbot（协议实现）。
 */
export const errorQQBotAdapter: ApiErrorData = {
  type: 'business_error',
  platform: 'douyin',
  error: {
    name: 'Error',
    message: '主动消息发送失败：主动消息推送数量已达上限',
    stack: '',
    businessName: '抖音推送',
    diagnostics: [
      { label: '接口', value: '/v2/groups/{group_openid}/messages' },
      { label: '响应码', value: '22009' },
      { label: '错误描述', value: 'push message is limited' },
      { label: '建议', value: '官方 Bot 的主动推送有每月配额，超出后需等次月重置或申请提额' }
    ]
  },
  method: '抖音推送',
  timestamp: '2026-08-26T02:14:52.881Z',
  logs: [
    { timestamp: '10:14:52.878', level: 'ERRO', message: '[抖音] 推送失败：push message is limited (22009)', raw: '[10:14:52.878][ERRO] [抖音] 推送失败：push message is limited (22009)' },
    { timestamp: '10:14:52.104', level: 'INFO', message: '[抖音] 正在向 2 个群推送 @柴犬阿柴 的新作品', raw: '[10:14:52.104][INFO] [抖音] 正在向 2 个群推送 @柴犬阿柴 的新作品' },
    { timestamp: '10:14:51.663', level: 'MARK', message: '[抖音] 检测到新作品 7412963855104871234', raw: '[10:14:51.663][MARK] [抖音] 检测到新作品 7412963855104871234' },
    // 主动推送没有事件对象，群号来自推送配置；用户那行本来就不存在
    { timestamp: '', level: 'INFO', message: '群: 8A3F2C91D7E64B05', raw: '群: 8A3F2C91D7E64B05' }
  ],
  frameworkVersion: '3.1.6',
  pluginVersion: '2.39.3',
  buildTime: '2026年08月26日 09:52',
  commitHash: '50d2e8b',
  adapterInfo: {
    name: 'QQBot',
    version: '1.0.32',
    platform: 'QQBot',
    protocol: 'qqbot',
    standard: 'qqbot',
    // QQBot 主动外连官方网关（wss://api.sgroup.qq.com/websocket），是客户端方向
    communication: 'webSocketClient'
  }
}
