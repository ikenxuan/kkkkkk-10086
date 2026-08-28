/**
 * 「基础配置」分组：四个平台的 Cookie，以及 app 的全局开关、渲染与媒体、API 服务。
 *
 * cookies 和 app 是两个 yaml，但在面板上共用同一个 SOFT_GROUP_BEGIN 分组，所以放在
 * 同一个文件里——本目录按面板分组切分，不按 yaml 文件名切分。
 */
import { divider, group, num, option, password, radio, select, sw } from '../../../module/guoba/helpers.js';
export const basic = [
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
    sw('app.cacheEnabled', '接口响应缓存', '缓存平台接口响应：表情列表等准静态数据长期复用，作品详情短期复用，多个群同时解析同一条链接只请求一次。登录、扫码、风控验证等接口永不缓存'),
    sw('app.EmojiReply', '表情回应', '适配器或平台不支持时可关闭'),
    sw('app.removeCache', '删除视频缓存', '自动删除下载到本地的视频缓存。保存目录云崽下的temp/kkkkkk-10086/kkkdownload，若要关闭请随时留意硬盘容量'),
    sw('app.sendforwardmsg', '发送合并转发消息', '发送合并转发消息，可能多用于抖音解析'),
    sw('app.fakeForward', '伪造合并转发消息', '开启后使用触发者身份展示转发'),
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
    sw('app.RemoveWatermark', '移除底部版本信息', '渲染图片是否移除底部版本信息'),
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
];
