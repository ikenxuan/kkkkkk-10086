/** 「小红书配置」分组：小红书解析开关、发送内容、评论数量与画质。 */
import { divider, group, num, radio, select, sw } from '../../../module/guoba/helpers.js';
import { sendContentOptions, videoQualityOptions } from '../../../module/guoba/shared.js';
export const xiaohongshu = [
    group('小红书配置'),
    divider('小红书解析'),
    sw('xiaohongshu.switch', '小红书解析开关', '受总开关影响'),
    select('xiaohongshu.sendContent', '发送内容', sendContentOptions, '解析时发送的内容，可选值：info、comment、image、video', true),
    num('xiaohongshu.numcomment', '评论解析数量', 0, 9999, '条', '小红书评论数量（后续评论图使用）'),
    radio('xiaohongshu.videoQuality', '视频画质偏好', videoQualityOptions, '视频画质偏好设置，adapt 为自动根据 maxAutoVideoSize 选择，其他为固定画质，可选值：540p、720p、1080p、2k、4k、adapt'),
    num('xiaohongshu.maxAutoVideoSize', '自动画质最大视频大小', 0, 9999, 'MB', '视频体积上限，自动画质模式下可接受的最大视频大小（单位：MB）')
];
