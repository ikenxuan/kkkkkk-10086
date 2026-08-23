/**
 * 远端标题 -> 本地文件名的统一清洗。
 *
 * 为什么要连 shell 元字符一起剔：这些名字来自远端作品标题（抖音 preview_title、
 * B站 share_copy / desc、快手 caption、小红书 title），落盘后会被拼进 ffmpeg 命令串，
 * 而 FFmpeg.ts 的 `exec` 走的是 shell。实测过：标题里带一对反引号，POSIX sh 下
 * 双引号内仍做命令替换，payload 会真的执行（Windows 上 cmd.exe 不认反引号，
 * 所以这条只打 Linux / macOS 用户）。
 *
 * 原来仓库里有 8 处各写一遍的 `[\\/:*?"<>|\r\n\s]`，只挡了文件系统非法字符，
 * 反引号、`$`、`;`、`&` 全部放过。这里统一成一处，两类字符一起挡：
 * - 文件系统非法：`\ / : * ? " < > |` 和控制字符
 * - shell / cmd 元字符：反引号 `$ ; & | ( ) < > ' " ! ^ %` 和换行
 *
 * 注意这不替代参数化执行。命令构造改成 execFile + 参数数组才是根治，
 * 那要动 FFmpeg.ts 全部命令构造和 5 个外部调用点，单独一轮做；
 * 在那之前这层清洗是唯一的封口，所以别把它绕过去。
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
