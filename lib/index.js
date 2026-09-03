import { loadApps } from './module/loader/index.js';
import Common from './module/utils/Common.js';
import Config from './module/utils/Config.js';
// 初始化数据库
const { initAllDatabases } = await import('./module/db/index.js');
await initAllDatabases();
// 定义需要创建的目录
const dirs = [
    Common.tempDri.images,
    Common.tempDri.video
];
// 并行创建所有目录
try {
    await Promise.all(dirs.map(dir => Common.mkdir(dir)));
    logger.info('所有目录创建成功');
}
catch (e) {
    logger.error('创建目录失败', e);
}
// 加载apps
const { apps, failedFiles } = await loadApps();
for (const { file, error } of failedFiles) {
    logger.error(`载入插件错误：${file}`, error);
}
/*
  直播预览队列的重启恢复。

  放在 apps 之后：恢复出来的项会立刻开始录制并主动发消息，而主动发消息要 `Bot[self_id]`
  已经就位。放在目录创建之后也是必要的 —— 录制要往 tempDri.video 落盘。

  不 await：账本里可能有二十个房间，逐个录是分钟级的，卡在这里会让整个插件的加载
  停在启动阶段。失败只记日志，恢复不了不该拖垮插件本身。
*/
const { restoreLivePreviewQueue } = await import('./module/platform/common/livePreview.js');
restoreLivePreviewQueue().catch(error => logger.error('[直播预览] 队列恢复失败', error));
export { apps };
logger.info('---------- ₍˄·͈༝·͈˄*₎◞ ̑̑ -----------');
logger.info('kkkkkk-10086初始化~');
logger.info('Created By ikenxuan');
logger.info('交流群：795874649');
logger.info('---------------------------------');
if (Config.app.APIServer) {
    const { startPluginServer } = await import('./module/server/index.js');
    startPluginServer();
}
