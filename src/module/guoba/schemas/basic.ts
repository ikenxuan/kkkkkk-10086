/**
 * 「基础配置」分组：四个平台的 Cookie，以及 app 的全局开关、渲染与媒体、API 服务。
 *
 * cookies 和 app 是两个 yaml，但在面板上共用同一个 SOFT_GROUP_BEGIN 分组，所以放在
 * 同一个文件里——本目录按面板分组切分，不按 yaml 文件名切分。
 */
import { divider, group, num, option, password, radio, select, sw } from '@/module/guoba/helpers'

import type { GuobaSchema } from '@/types/guoba'

export const basic: GuobaSchema[] = [
  group('基础配置'),
  divider('Cookie 配置'),
  password('cookies.douyin', '抖音 Cookie', '登录 https://www.douyin.com/ 获取请求头中的 Cookie，或使用 #kkk设置抖音ck 查看教程'),
  password('cookies.bilibili', 'B站 Cookie', '不设置时视频画质通常受限，登录 https://www.bilibili.com/ 获取请求头中的 Cookie'),
  password('cookies.kuaishou', '快手 Cookie', '登录 https://www.kuaishou.com/new-reco 获取请求头中的 Cookie'),
  password('cookies.xiaohongshu', '小红书 Cookie', '登录 https://www.xiaohongshu.com/ 获取请求头中的 Cookie'),

  divider('全局开关'),
  sw('app.videotool', '总开关', '视频解析工具总开关，修改后重启生效，关闭后可使用 解析/kkk解析/弹幕解析 + 视频分享链接代替'),
  sw('app.videoTool', '总开关（新版键）', '兼容 Karin 新配置名，建议与总开关保持一致'),
  sw('app.defaulttool', '默认解析', '识别最高优先级，修改后重启生效'),
  num('app.priority', '解析优先级', 0, 114514, '', '默认解析关闭后生效，修改后重启生效'),
  sw('app.parseTip', '解析提示', '发送“检测到链接，开始解析”提示'),
  num('app.parseConcurrency', '解析并发数', 1, 16, '路', '控制同时解析任务数，建议保持默认 2 路'),
  sw('app.EmojiReply', '表情回应', '适配器或平台不支持时可关闭'),
  sw('app.removeCache', '删除视频缓存', '自动删除下载到本地的视频缓存。保存目录云崽下的temp/kkkkkk-10086/kkkdownload，若要关闭请随时留意硬盘容量'),
  sw('app.sendforwardmsg', '发送合并转发消息', '发送合并转发消息，可能多用于抖音解析'),
  sw('app.fakeForward', '伪造合并转发消息', '开启后使用触发者身份展示转发'),
  divider('临时缓存清理（修改后重启生效）'),
  num('app.cache.orphanHours', '异常退出工作区有效期', 1, 720, '小时', '只处理本插件拥有的临时目录；活跃进程租约和在用文件始终受保护'),
  num('app.cache.legacyHours', '旧版 HTML 有效期', 1, 2160, '小时', '旧版 HTML 不参与缓存复用，默认保留七天后分批清理；不会清理其他插件的目录'),
  num('app.cache.mediaMinutes', '媒体复用有效期', 1, 1440, '分钟', '在最后一个下载、转码、上传或预览消费者结束后开始计时；关闭删除时仍保留原有用户存档'),
  num('app.cache.maxFiles', '临时缓存文件上限', 10, 100000, '项', '超过上限时分批回收已闲置的受管缓存；在用工作区和未达到安全年龄的文件优先保留'),
  num('app.cache.maxSizeMB', '临时缓存空间上限', 16, 10240, 'MB', '容量阈值用于分批兜底回收，活跃任务不受驱逐；不能用于限制下载或用户存档大小'),
  num('app.cache.sweepMinutes', '兜底清扫间隔', 1, 1440, '分钟', '启动后异步清扫，此后定期分批扫描；每轮有固定扫描和删除预算，不阻塞插件加载'),
  num('app.cache.debugHours', '调试文件有效期', 1, 168, '小时', '仅 KKK_TEMPLATE_CAPTURE=1 显式开启时保留调试HTML与快照；到期和超限均可回收'),
  num('app.cache.debugMaxFiles', '调试文件数量上限', 1, 1000, '项', '只作用于受管调试目录，不扫描或删除模板树中的手工数据与用户文件'),
  num('app.cache.debugMaxSizeMB', '调试文件空间上限', 1, 1024, 'MB', '快照可能含真实消息数据，默认不保留；启用后仍以有效期和容量双重限制保留量'),
  select('app.errorLogSendTo', '错误日志接收者', [
    option('主人', 'master'),
    option('全部主人', 'allMasters'),
    option('触发者', 'trigger')
  ], '遇到错误时谁会收到错误日志？可选值：master、allMasters、trigger', true),

  divider('渲染与媒体'),
  radio('app.Theme', '主题配置', [
    option('根据时间自动切换', 0),
    option('浅色', 1),
    option('深色', 2),
    option('智能场景（根据封面）', 3)
  ], '评论图、推送图主题配置'),
  num('app.ambientCover.coverOpacity', '封面氛围强度', 0, 1, '', '模糊封面层不透明度'),
  num('app.ambientCover.overlayEdgeOpacity', '封面边缘压色', 0, 1, '', '主题色压色罩两端不透明度'),
  num('app.ambientCover.overlayMiddleOpacity', '封面中部压色', 0, 1, '', '主题色压色罩中间带不透明度'),
  num('app.renderScale', '渲染精度', 50, 200, '%', '可选值50~200，建议100。设置高精度会提高图片的精细度，但因图片较大可能会影响渲染与发送速度'),
  num('app.RenderWaitTime', '渲染等待时间', 0, 300, '秒', '传递 0 可禁用等待'),
  sw('app.multiPageRender', '分页渲染', '将模板渲染成多页图片以降低渲染器压力'),
  num('app.multiPageHeight', '分页高度', 1000, 50000, 'px', '分页渲染时，每页的高度'),
  radio('app.livePhotoSystem', 'Live Photo 兼容系统', [
    option('Google', 'google'),
    option('Xiaomi', 'xiaomi'),
    option('OPPO', 'oppo'),
    option('Huawei / Honor', 'huawei_honor')
  ], 'Live Photo 兼容系统，可选值：google、xiaomi、oppo、huawei_honor'),
  radio('app.livePhotoMode', 'Live Photo 发送方式', [
    option('视频 + Live Photo', 'video_and_livephoto'),
    option('仅视频', 'video_only'),
    option('仅 Live Photo', 'livephoto_only')
  ], 'Live Photo 发送方式，可选值：video_and_livephoto、video_only、livephoto_only'),

  divider('API 服务（非配置面板）'),
  sw('app.APIServer', 'API 服务开关', '仅放出解析 API 与视频预览，不再提供 Web 配置面板'),
  num('app.APIServerPort', 'API 服务端口', 1, 65535, '', 'API服务端口'),
  sw('app.APIServerMount', '挂载到框架 HTTP 服务', 'Yunzai 版当前保留配置，独立 API 服务仍使用端口启动')
]
