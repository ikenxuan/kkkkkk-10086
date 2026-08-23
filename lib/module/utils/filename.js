/**
 * 远端标题 -> 本地文件名的统一清洗。
 *
 * 这些名字来自远端作品标题（抖音 preview_title、B站 share_copy / desc、
 * 快手 caption、小红书 title），落盘后会作为路径交给 ffmpeg。
 *
 * 原来仓库里有 8 处各写一遍的 `[\\/:*?"<>|\r\n\s]`，只挡了文件系统非法字符，
 * 反引号、`$`、`;`、`&` 全部放过。这里统一成一处，两类字符一起挡：
 * - 文件系统非法：`\ / : * ? " < > |` 和控制字符
 * - shell / cmd 元字符：反引号 `$ ; & | ( ) < > ' " ! ^ %` 和换行
 *
 * 关于第二类：注入本身已经在 `FFmpeg.ts` 那侧根治了 —— 命令全部走
 * `execFile` + 参数数组，参数逐个交给内核、不经过 shell，所以文件名里
 * 有什么字符都只是那个参数的字面内容（`tests/unit/ffmpeg-argv.test.ts`
 * 拿真 payload 钉着这条）。这层清洗因此不再是注入的封口，留着元字符
 * 是出于另外两个理由：文件名会出现在日志、消息文本和群文件名里，
 * 而且将来若有人新写一处 shell 调用，这里已经是干净的。
 *
 * 也就是说：这层管「能否安全落盘、能否安全显示」，`execFile` 管「能否被执行」。
 * 两件事，别把任一层当成另一层的替代。
 */
/** 文件系统非法字符 + shell/cmd 元字符 + 控制字符，一律替换成空格 */
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|`$;&()'!^%\r\n\t\v\f\0]/g;
/**
 * 把远端标题清洗成可安全落盘、可安全拼进命令的文件名片段。
 *
 * @param value 原始标题（远端不可信输入）
 * @param maxLength 最大长度，默认 50
 * @param fallback 清洗后为空时的兜底名
 */
export const sanitizeFilenameSegment = (value, maxLength = 50, fallback = 'file') => {
    const cleaned = String(value ?? '')
        .replace(UNSAFE_FILENAME_CHARS, ' ')
        // 折叠连续空白：清洗会把一串元字符变成一串空格，留着既难看也没用
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, maxLength)
        .trim();
    return cleaned || fallback;
};
/**
 * 清洗文件名并保留扩展名。
 *
 * 长度限制只作用于主干，扩展名总是完整保留 —— 截断到一半的扩展名会让
 * 后续按后缀判类型的逻辑（ffmpeg 的容器推断、图片扩展名判断）失效。
 */
export const sanitizeFilename = (filename, maxLength = 50, fallback = 'file') => {
    const raw = String(filename ?? '');
    const lastDotIndex = raw.lastIndexOf('.');
    const hasExtension = lastDotIndex > 0 && lastDotIndex < raw.length - 1;
    if (!hasExtension)
        return sanitizeFilenameSegment(raw, maxLength, fallback);
    const stem = sanitizeFilenameSegment(raw.substring(0, lastDotIndex), maxLength, fallback);
    // 扩展名同样要清洗：`.mp4;rm -rf /` 这种也是远端能给出的形状
    const extension = sanitizeFilenameSegment(raw.substring(lastDotIndex + 1), 16, 'bin');
    return `${stem}.${extension}`;
};
