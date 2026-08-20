/**
 * 模板 payload 契约表：把 `ktr/template/<route>/components/types.ts` 里的真实契约
 * 补充声明进 `src/module/utils/react-template/template-data.ts` 的 `TemplateDataMap`。
 *
 * 这个文件**只被 `tsconfig.render.json` 收录**，构建用的根 program 看不到它。
 * 原因是根 program 的 `rootDir` 是 `./src`，把 `ktr/**` 的 .ts 拉进去会直接 TS6059；
 * 而契约又不该为了迁就编译配置就从上游模板树里搬出来（`ktr/` 是照搬上游的，搬了以后没法同步）。
 * 所以拆成两个 program：构建时表是空的、`Render()` 退回宽松校验；
 * `pnpm typecheck:render` 时表被填满，`src/` 里每个 `Render()` 调用点按真实契约检查。
 *
 * 每条映射的类型名不是猜的，是各模板自己 `PosterProps<X>` 里的那个 X。
 * 新增模板路由后这里也要加一条，否则那个路由的调用点仍然是宽松校验（不会报错，但也拦不住漏字段）。
 */
import type { BangumiBilibiliData } from '../ktr/template/bilibili/bangumi/components/types'
import type { BilibiliCommentData } from '../ktr/template/bilibili/comment/components/types'
import type { BilibiliArticleDynamicData } from '../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_ARTICLE/components/types'
import type { BilibiliVideoDynamicData } from '../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_AV/components/types'
import type { BilibiliDynamicData } from '../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_DRAW/components/types'
import type { BilibiliForwardDynamicData } from '../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_FORWARD/components/types'
import type { BilibiliLiveDynamicData } from '../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD/components/types'
import type { BilibiliWordDynamicData } from '../ktr/template/bilibili/dynamic/DYNAMIC_TYPE_WORD/components/types'
import type { BilibiliQrcodeImgData } from '../ktr/template/bilibili/qrcodeImg/components/types'
import type { BilibiliUserListData } from '../ktr/template/bilibili/userlist/components/types'
import type { BilibiliVideoInfoData } from '../ktr/template/bilibili/videoInfo/components/types'
import type { DouyinArticleWorkData } from '../ktr/template/douyin/article-work/components/types'
import type { DouyinCommentData } from '../ktr/template/douyin/comment/components/types'
import type { DouyinDynamicData } from '../ktr/template/douyin/dynamic/components/types'
import type { DouyinFavoriteListData } from '../ktr/template/douyin/favorite-list/components/types'
import type { DouyinImageWorkData } from '../ktr/template/douyin/image-work/components/types'
import type { DouyinLiveData } from '../ktr/template/douyin/live/components/types'
import type { DouyinMusicInfoData } from '../ktr/template/douyin/musicinfo/components/types'
import type { DouyinQrcodeImgData } from '../ktr/template/douyin/qrcodeImg/components/types'
import type { DouyinRecommendListData } from '../ktr/template/douyin/recommend-list/components/types'
import type { DouyinUserVideoListData } from '../ktr/template/douyin/user_profile/components/types'
import type { DouyinUserListData } from '../ktr/template/douyin/userlist/components/types'
import type { DouyinVideoWorkData } from '../ktr/template/douyin/video-work/components/types'
import type { KuaishouCommentData } from '../ktr/template/kuaishou/comment/components/types'
import type { ChangelogData } from '../ktr/template/other/changelog/components/types'
import type { ApiErrorData } from '../ktr/template/other/handlerError/components/types'
import type { HelpData } from '../ktr/template/other/help/components/types'
import type { LivePhotoTipData } from '../ktr/template/other/live-photo-tip/components/types'
import type { QrLoginData } from '../ktr/template/other/qrlogin/components/types'
import type { RuntimeReportData } from '../ktr/template/other/runtime/components/types'
import type { VersionWarningData } from '../ktr/template/other/version_warning/components/types'
import type { GlobalStatisticsData } from '../ktr/template/statistics/global/components/types'
import type { GroupStatisticsData } from '../ktr/template/statistics/group/components/types'
import type { XiaohongshuCommentData } from '../ktr/template/xiaohongshu/comment/components/types'
import type { XiaohongshuNoteInfoData } from '../ktr/template/xiaohongshu/noteInfo/components/types'

declare module '@/module/utils/react-template/template-data' {
  interface TemplateDataMap {
    'bilibili/bangumi': BangumiBilibiliData
    'bilibili/comment': BilibiliCommentData
    'bilibili/dynamic/DYNAMIC_TYPE_ARTICLE': BilibiliArticleDynamicData
    'bilibili/dynamic/DYNAMIC_TYPE_AV': BilibiliVideoDynamicData
    'bilibili/dynamic/DYNAMIC_TYPE_DRAW': BilibiliDynamicData
    'bilibili/dynamic/DYNAMIC_TYPE_FORWARD': BilibiliForwardDynamicData
    'bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD': BilibiliLiveDynamicData
    'bilibili/dynamic/DYNAMIC_TYPE_WORD': BilibiliWordDynamicData
    'bilibili/qrcodeImg': BilibiliQrcodeImgData
    'bilibili/userlist': BilibiliUserListData
    'bilibili/videoInfo': BilibiliVideoInfoData
    'douyin/article-work': DouyinArticleWorkData
    'douyin/comment': DouyinCommentData
    'douyin/dynamic': DouyinDynamicData
    'douyin/favorite-list': DouyinFavoriteListData
    'douyin/image-work': DouyinImageWorkData
    'douyin/live': DouyinLiveData
    'douyin/musicinfo': DouyinMusicInfoData
    'douyin/qrcodeImg': DouyinQrcodeImgData
    'douyin/recommend-list': DouyinRecommendListData
    'douyin/user_profile': DouyinUserVideoListData
    'douyin/userlist': DouyinUserListData
    'douyin/video-work': DouyinVideoWorkData
    'kuaishou/comment': KuaishouCommentData
    'other/changelog': ChangelogData
    'other/handlerError': ApiErrorData
    'other/help': HelpData
    'other/live-photo-tip': LivePhotoTipData
    'other/qrlogin': QrLoginData
    'other/runtime': RuntimeReportData
    'other/version_warning': VersionWarningData
    'statistics/global': GlobalStatisticsData
    'statistics/group': GroupStatisticsData
    'xiaohongshu/comment': XiaohongshuCommentData
    'xiaohongshu/noteInfo': XiaohongshuNoteInfoData
  }
}
