/**
 * 「群组解析统计」(`#kkk解析统计`) 的开发面板 mock。
 *
 * 关于不用 `defineMock`、以及导出名为什么带模板前缀，见 other/runtime/mock.ts 顶部的说明。
 *
 * 数字不是随手填的，几条**语义不变式**必须成立，否则面板上看着正常、
 * 却和真实生产数据长得不一样，排版和「合不合理」两件事就都验不了：
 *
 * 1. `groupTotalParses` == `platformData` 四项之和（生产端就是这么求和出来的）；
 * 2. `platformData` 每一项 == `userRanking` 里该平台的**列和**（同一批记录的两种切法）；
 * 3. 每个用户的 `totalParses` == 他自己四个平台之和（行和）；
 * 4. `mediaMetrics.platforms` 的 mediaCount / totalDurationMs / totalBytes 加起来
 *    == 顶层的同名字段；`durationSamples` 同理，且 == `videoCount + audioCount`
 *    （只有视频和音频带时长，图片不带）。
 *
 * 所有时长单位都是**毫秒**，格式化（`1h23m` / `45s`）是模板的事。
 */
import type { GroupStatisticsData } from './components/types'

/**
 * 完整形态：带用户排行 + 媒体统计两个可选区块。
 *
 * 排行第三名刻意用 QQBot 的 32 位 openid：那种 ID 拼不出 QQ 头像直链，
 * 所以 `avatar` 缺省、模板那格整个不渲染（而不是塞一个必然 404 的地址进去），
 * `nickname` 也是调用点截断成头尾的形态。这一行就是为了眼睛能看到
 * 「无头像 + 昵称被截断」到底排成什么样 —— 全填 QQ 号永远测不到。
 */
export const groupFull: GroupStatisticsData = {
  groupId: '114514114',
  groupName: '抖音B站解析测试群',
  // 生产端从来不传这个字段（组件读了但没人喂），这里补上，
  // 好让 `groupMemberCount && <span>` 那条分支至少在面板上能被看到一次
  groupMemberCount: 486,
  groupAvatar: 'https://p.qlogo.cn/gh/114514114/114514114/640',
  // == platformData 四项之和 43+36+8+8
  groupTotalParses: 95,
  groupUniqueUsers: 6,
  // 每一项 == 下面 userRanking 里该平台的列和
  platformData: {
    douyin: 43,
    bilibili: 36,
    kuaishou: 8,
    xiaohongshu: 8
  },
  globalTotalGroups: 37,
  globalTotalParses: 2841,
  // 按 totalParses 从多到少，和生产端 getGroupUserRanking 的降序一致
  userRanking: [
    {
      userId: '114514',
      nickname: '芝士雪豹',
      totalParses: 36,
      avatar: 'https://q1.qlogo.cn/g?b=qq&nk=114514&s=640',
      platforms: { douyin: 18, bilibili: 12, kuaishou: 4, xiaohongshu: 2 }
    },
    {
      userId: '1919810',
      nickname: '今天也不想写代码',
      totalParses: 27,
      avatar: 'https://q1.qlogo.cn/g?b=qq&nk=1919810&s=640',
      platforms: { douyin: 9, bilibili: 14, kuaishou: 1, xiaohongshu: 3 }
    },
    {
      // QQBot 适配器给的是一长串 openid，不是纯数字 uin
      userId: 'A1B2C3D4E5F60718293A4B5C6D7E8F90',
      // 取不到群昵称时由调用点回落成截断后的 userId（头 6 位 + … + 尾 4 位），
      // 模板自己不再兜底，所以这里必须是**已经截断好**的形态
      nickname: 'A1B2C3…8F90',
      totalParses: 15,
      // avatar 刻意缺省：openid 拼不出 q1.qlogo.cn 直链
      platforms: { douyin: 7, bilibili: 5, kuaishou: 2, xiaohongshu: 1 }
    },
    {
      userId: '2233445566',
      nickname: '摸鱼一号机',
      totalParses: 10,
      avatar: 'https://q1.qlogo.cn/g?b=qq&nk=2233445566&s=640',
      platforms: { douyin: 5, bilibili: 3, kuaishou: 0, xiaohongshu: 2 }
    },
    {
      userId: '888999000',
      nickname: '路过的咸鱼',
      totalParses: 5,
      avatar: 'https://q1.qlogo.cn/g?b=qq&nk=888999000&s=640',
      platforms: { douyin: 3, bilibili: 1, kuaishou: 1, xiaohongshu: 0 }
    },
    {
      userId: '10001',
      nickname: '刚进群的萌新',
      totalParses: 2,
      avatar: 'https://q1.qlogo.cn/g?b=qq&nk=10001&s=640',
      platforms: { douyin: 1, bilibili: 1, kuaishou: 0, xiaohongshu: 0 }
    }
  ],
  mediaMetrics: {
    // 58 + 41 + 8 + 21，一次解析可能产出多条（图集里每张各算一条），所以比 95 次解析多
    mediaCount: 128,
    // 52（抖音视频）+ 37（B站视频）
    videoCount: 89,
    audioCount: 4,
    // 2_184_000 + 19_680_000，快手/小红书两边都是 0
    totalDurationMs: 21_864_000,
    videoDurationMs: 20_956_000,
    audioDurationMs: 908_000,
    // 52 + 41 == videoCount + audioCount：只有视频和音频带时长，图片不带
    durationSamples: 93,
    // 21_864_000 / 93
    averageDurationMs: 235_097,
    maxDurationMs: 2_845_000,
    totalBytes: 3_657_330_608,
    averageProcessingMs: 3_180,
    successRate: 0.9474,
    platforms: {
      douyin: {
        mediaCount: 58,
        totalDurationMs: 2_184_000,
        // 58 条里 6 条是图文作品，没有时长；分母只算真拿到时长的那 52 条
        durationSamples: 52,
        averageDurationMs: 42_000,
        maxDurationMs: 186_000,
        totalBytes: 731_284_912
      },
      bilibili: {
        mediaCount: 41,
        totalDurationMs: 19_680_000,
        durationSamples: 41,
        averageDurationMs: 480_000,
        maxDurationMs: 2_845_000,
        totalBytes: 2_812_446_208
      },
      // 快手和小红书当前的解析路径上压根拿不到时长字段，所以 durationSamples 是 0，
      // 而 averageDurationMs / maxDurationMs 必须**整个缺省**、不能写 0。
      // 「一条时长都没采到」和「平均 0 秒」在卡片上是两回事，后者会让人以为解析出了空视频。
      // 模板按 undefined 决定那两格要不要渲染 —— 谁要是「顺手补个 0」，这条分支就死了。
      kuaishou: {
        mediaCount: 8,
        totalDurationMs: 0,
        durationSamples: 0,
        totalBytes: 74_186_752
      },
      xiaohongshu: {
        mediaCount: 21,
        totalDurationMs: 0,
        durationSamples: 0,
        totalBytes: 39_412_736
      }
    }
  }
}

/**
 * 最小形态：`userRanking` 与 `mediaMetrics` 两个可选区块都不传。
 *
 * 这是新装用户、或 MediaMetrics 表还没攒到数据时的真实形态 ——
 * 组件那边两处都有守卫（`props.data.mediaMetrics &&` 和 `props.data.userRanking?.length ?`），
 * 整块跳过。顺带把 `groupAvatar` / `groupMemberCount` 也去掉：
 * 生产端本来就不传后者，这样两条 falsy 分支的排版也能一起看。
 */
export const groupMinimal: GroupStatisticsData = {
  groupId: '233666888',
  groupName: '前端摸鱼研究所',
  // == 6 + 3 + 0 + 1
  groupTotalParses: 10,
  groupUniqueUsers: 3,
  // 这个群没人发过快手链接，0 在这里是真的「没有」，不是缺数据
  platformData: {
    douyin: 6,
    bilibili: 3,
    kuaishou: 0,
    xiaohongshu: 1
  },
  globalTotalGroups: 37,
  globalTotalParses: 2841
}
