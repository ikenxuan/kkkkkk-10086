import { MAX_MEDIA_TASK_TIMEOUT_MS } from './MediaTasks.js';
import { withDownloadBucket } from './Network/DownloadBudget.js';
import { ParseScheduler } from './ParseScheduler.js';
/**
 * 发送/上传那一段留出的余量。
 *
 * 视频下载支线自己就能合法跑满 `MAX_MEDIA_TASK_TIMEOUT_MS`（10 分钟），而下载完成
 * **不等于**这次解析完成：字节落盘之后还要走上传（`Config.upload.filelimit` 默认
 * 1536MB，这一步同样按分钟计），以及发送、临时文件清理。外层预算必须装得下
 * 「下载跑满 + 上传」这个最坏情形，否则最重的那条支线永远走不到终点。
 *
 * 取 2 分钟而不是更多：这是余量而不是第二个业务预算 —— 内层每条支线都已经有
 * 自己的守卫了，外层只负责兜「所有内层守卫都没能收场」的情况，留太多等于让一次
 * 死掉的解析长时间占着并发位。
 */
const PARSE_DISPATCH_HEADROOM_MS = 120_000;
/**
 * 一次解析的默认硬预算。
 *
 * **从内层最大预算推导，不是一个独立选定的数字**：外层守卫必须严格晚于内层最重的
 * 支线放弃，否则两者赛跑 —— 外层先炸的话，表情反馈会在超时点翻 ERROR 而视频随后
 * 照样发出去（用户看到「失败了但又成功了」）；同时指纹被提前从 pending 里摘掉，
 * 同一条链接重发会再跑一整次完整解析，并发计数也提前释放，真实并发超过配置值。
 *
 * 所以这里只允许写成「内层上限 + 收尾余量」的形式。要调，调
 * {@link PARSE_DISPATCH_HEADROOM_MS}，不要把这里换成字面量 —— 那样 MediaTasks
 * 那边一改上限，这个不变量就会静默失效。
 */
export const DEFAULT_PARSE_TIMEOUT_MS = MAX_MEDIA_TASK_TIMEOUT_MS + PARSE_DISPATCH_HEADROOM_MS;
const FINGERPRINT_VERSION = 'parse:v1:';
const requiredText = (value, label) => {
    const normalized = String(value).trim();
    if (normalized.length === 0) {
        throw new TypeError(`${label} must not be empty`);
    }
    return normalized;
};
const normalizePlatform = (platform) => (requiredText(platform, 'platform').toLowerCase());
const normalizeUrl = (value) => {
    const source = requiredText(value, 'target URL');
    let url;
    try {
        url = new URL(source);
    }
    catch {
        throw new TypeError('target URL must be an absolute HTTP or HTTPS URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new TypeError('target URL must use HTTP or HTTPS');
    }
    url.hash = '';
    url.searchParams.sort();
    return url.href;
};
const normalizeTarget = (target) => {
    if (target.type === 'url') {
        return [target.type, normalizeUrl(target.value)];
    }
    if (target.type === 'work-id') {
        return [target.type, requiredText(target.value, 'work ID')];
    }
    throw new TypeError('target type must be url or work-id');
};
const normalizeScope = (scope) => {
    if (scope.type !== 'group' && scope.type !== 'private') {
        throw new TypeError('scope type must be group or private');
    }
    return [scope.type, requiredText(scope.id, 'scope ID')];
};
export const createParseFingerprint = (identity) => {
    const normalized = [
        normalizePlatform(identity.platform),
        ...normalizeTarget(identity.target),
        ...normalizeScope(identity.scope)
    ];
    return `${FINGERPRINT_VERSION}${JSON.stringify(normalized)}`;
};
const ignoreReactionFailure = () => { };
const notifyReaction = (port, state) => {
    if (port === undefined)
        return;
    try {
        Promise.resolve(port.setState(state)).catch(ignoreReactionFailure);
    }
    catch {
        // Reactions are status hints; the in-memory scheduler remains authoritative.
    }
};
export class ParseCoordinator {
    scheduler;
    constructor(options = {}) {
        this.scheduler = new ParseScheduler({
            concurrency: options.concurrency,
            // 显式落一个默认值，而不是把 undefined 传下去让 ParseScheduler 退到
            // guard 的 60s：那个 60s 是「一次网络请求」的尺度，装不下一次完整解析。
            timeoutMs: options.timeoutMs ?? DEFAULT_PARSE_TIMEOUT_MS
        });
    }
    submit(identity, task, reaction) {
        const fingerprint = createParseFingerprint(identity);
        // 下载连接预算的桶标签就在这里落地：identity.platform 是全仓库唯一一处
        // 「一次解析属于哪个平台」的权威来源，而 withDownloadBucket 用 AsyncLocalStorage
        // 把它铺到整条调用链上 —— downloadFile / downloadVideo / processImageUrl /
        // buildLivePhotoMessages 这些深层 helper 因此不用改签名就能记入正确的桶。
        //
        // 套在 scheduler.submit 的任务闭包**里面**而不是外面：run() 必须在任务真的开始
        // 执行时进入，这样任务内部创建的所有异步资源才继承得到上下文。套在外面的话，
        // 排队期间上下文早就退出了，被调度器延后启动的任务会落到 default 桶。
        // 两层闭包都得把 signal 接住再往里递。以前这里是两个零参箭头函数，
        // guard 递进来的取消信号直接掉在地上：超时点上外层 Promise reject 了，
        // 真实任务却毫无察觉地跑到底，继续占着连接和内存。
        return this.scheduler.submit(fingerprint, async (signal) => await withDownloadBucket(identity.platform, async () => {
            notifyReaction(reaction, 'processing');
            try {
                const result = await task(signal);
                notifyReaction(reaction, 'succeeded');
                return result;
            }
            catch (error) {
                notifyReaction(reaction, 'failed');
                throw error;
            }
        }));
    }
    getSnapshot() {
        return this.scheduler.getSnapshot();
    }
}
/**
 * 当前在用的那个协调器。
 *
 * 诊断卡要读解析队列的实时数字，但协调器实例是 `apps/tools.ts` 的模块级 const，
 * 而 `runtime-report.ts` 不能反过来引 apps 层（apps 引 utils，反向引会成环，
 * 且 tools.ts 一加载就会注册命令、读一遍配置）。所以由 tools.ts 主动登记，
 * 报告侧只读这个引用 —— 和 ApiCache / DownloadBudget 那两套「模块级单例导出只读快照」
 * 是同一个形状，只是实例的所有权在 apps 层，多一次登记动作。
 */
let activeCoordinator;
export const setActiveParseCoordinator = (coordinator) => {
    activeCoordinator = coordinator;
};
/**
 * 解析队列的只读快照。
 *
 * 返回 undefined 表示还没有协调器登记（比如只加载了 utils 层的单元测试环境），
 * 诊断卡据此写「未初始化」而不是画一排 0 —— 后者会被读成「队列是空的」。
 */
export const getParseCoordinatorSnapshot = () => activeCoordinator?.getSnapshot();
