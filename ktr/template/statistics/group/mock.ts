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
  /*
    这三个大号数字刻意覆盖**三个不同的字号档**，别为了「好看」改回全短值。

    原来这组是 `6.1小时 / 3.9分 / 3.4GB`，三个都是 3 字 —— 而 3 字恰好是卡内
    261.3px 唯一装得下的一档，所以开发面板上永远看不到溢出。线上真实数据出现
    `347.7MB`（5 字）时数值宽 281.2px，比整个可用宽还宽，被根节点的
    overflow-hidden 从字形中间切断；单位 `小时` 则在 小/时 之间静默折成两行。

    现在：总时长 `1.1小时`（3 字 → 7rem）、平均 `43.8秒`（4 字 → 5rem）、
    体积 `347.7MB`（5 字 → 4rem，就是线上出问题的那一组）。面板一眼能看出
    三档字号是否都排得下。字号映射见 ktr/utils/media-format.ts 的 valueSizeClass。

    时长整体调小是为了跟体积自洽：347.7MB / 67.8 分 ≈ 717 kbps，是短视频的
    正常码率。沿用原来的 6.07 小时会变成 134 kbps，那种数据生产端不会出现。
  */
  mediaMetrics: {
    // 58 + 41 + 8 + 21，一次解析可能产出多条（图集里每张各算一条），所以比 95 次解析多
    mediaCount: 128,
    // 52（抖音视频）+ 37（B站视频）
    videoCount: 89,
    audioCount: 4,
    // 2_184_000 + 1_886_000，快手/小红书两边都是 0；= 67.8 分 → 显示 `1.1小时`
    totalDurationMs: 4_070_000,
    // 3_900_000 + 170_000 == totalDurationMs
    videoDurationMs: 3_900_000,
    audioDurationMs: 170_000,
    // 52 + 41 == videoCount + audioCount：只有视频和音频带时长，图片不带
    durationSamples: 93,
    // 4_070_000 / 93 = 43_763.4，取整；= 43.8 秒 → 4 字档，验字号降到 5rem
    averageDurationMs: 43_763,
    // == bilibili 那条的 maxDurationMs（两个平台里更长的那个）
    maxDurationMs: 214_000,
    // == platforms 四项之和 155_189_248+167_772_160+12_582_912+29_040_640；
    // 347.7MB → 5 字档，就是线上溢出的那一组，验字号降到 4rem
    totalBytes: 364_584_960,
    averageProcessingMs: 3_180,
    successRate: 0.9474,
    platforms: {
      douyin: {
        mediaCount: 58,
        totalDurationMs: 2_184_000,
        // 58 条里 6 条是图文作品，没有时长；分母只算真拿到时长的那 52 条
        durationSamples: 52,
        // 2_184_000 / 52，整除
        averageDurationMs: 42_000,
        maxDurationMs: 186_000,
        // 148MB / 36.4 分 ≈ 568 kbps，抖音正常码率
        totalBytes: 155_189_248
      },
      bilibili: {
        mediaCount: 41,
        totalDurationMs: 1_886_000,
        durationSamples: 41,
        // 1_886_000 / 41，整除
        averageDurationMs: 46_000,
        maxDurationMs: 214_000,
        // 160MB / 31.4 分 ≈ 712 kbps，B 站码率比抖音高一档，符合实际
        totalBytes: 167_772_160
      },
      // 快手和小红书当前的解析路径上压根拿不到时长字段，所以 durationSamples 是 0，
      // 而 averageDurationMs / maxDurationMs 必须**整个缺省**、不能写 0。
      // 「一条时长都没采到」和「平均 0 秒」在卡片上是两回事，后者会让人以为解析出了空视频。
      // 模板按 undefined 决定那两格要不要渲染 —— 谁要是「顺手补个 0」，这条分支就死了。
      kuaishou: {
        mediaCount: 8,
        totalDurationMs: 0,
        durationSamples: 0,
        // 12MB / 8 条 = 1.5MB 每条
        totalBytes: 12_582_912
      },
      xiaohongshu: {
        mediaCount: 21,
        totalDurationMs: 0,
        durationSamples: 0,
        // 27.7MB / 21 条 ≈ 1.32MB 每条，图文为主所以单条比快手小
        totalBytes: 29_040_640
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
