/** 字节单位与体积格式化。下载各路都要拿它算门槛、打日志，独立出来免得每个模块自己写一遍字面量。 */
export const MB = 1024 * 1024;
export const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes))
        return 'unknown';
    if (bytes >= MB)
        return `${(bytes / MB).toFixed(1)}MB`;
    if (bytes >= 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    return `${bytes}B`;
};
