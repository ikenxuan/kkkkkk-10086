/**
 * 「运行环境诊断」(`#kkk版本`) 的开发面板 mock。
 *
 * 值的格式刻意照抄 src/module/utils/runtime-report.ts 的 collectRuntimeReport 输出，
 * 而不是随手编一批好看的字符串：这里每个字段都是**已经格式化好的展示文本**
 * （`1.00x` / `31.93 GB` / `2026年08月25日 21:40` / `3天 7小时 12分钟`），模板拿到就直接排版、
 * 不做二次解析。塞 ISO 时间或裸数字面板上照样能出图，但和线上排版不是一回事，
 * 反而会把真正的溢出、截断问题盖掉 —— 眼睛看 mock 的意义就没了。
 *
 * 刻意不用上游的 `defineMock`：tsconfig.template.json 把 `@karinjs/template-react`
 * 指到本仓自己的 shim（src/template-sdk/index.ts），那里没导出 defineMock，引它是 TS2305，
 * 而 `ktr/template/**` 在 typecheck:template 的 include 里，加一行就红。
 * 上游 defineMock 的实现就是 `data => data`（见 dist/client-*.mjs），
 * 带类型标注的普通导出完全等价，还省掉一个 shim 缺口。
 *
 * 导出名必须**全仓唯一**：ktr 生成 .ktr/mock-registry.ts 时对每个 mock 文件做
 * `export * from '…'`，三个模板各写一个 `basic` 会当场撞名。所以前缀带模板身份。
 */
import type { RuntimeReportData } from './components/types'

export const runtimeStable: RuntimeReportData = {
  // zh-CN + hour12:false 的 Intl 输出就是这个 `2026/08/25 22:14:07` 形状，不是 ISO
  snapshotAt: '2026/08/25 22:14:07',
  identity: {
    pluginName: 'kkkkkk-10086',
    pluginVersion: '2.39.3',
    // 本仓跑在 Yunzai 上，这格填的是宿主名 + 宿主版本，不是 Karin 版本
    karinVersion: 'TRSS-Yunzai 3.1.6',
    releaseType: 'Stable',
    requiredNodeVersion: '>=22.12.0',
    requiredKarinVersion: '>=3.1.3'
  },
  build: {
    // matched = lib/build-metadata.json 的版本和当前 package.json 一致
    state: 'matched',
    version: '2.39.3',
    // formatBuildTime 的产物，模板侧还要用 `yyyy年MM月dd日 HH:mm` 反解出「多久以前」，
    // 换成 ISO 会解析失败、那半句相对时间直接消失
    buildTime: '2026年08月25日 21:40',
    shortCommitHash: '77e7636'
  },
  runtime: {
    nodeVersion: 'v22.18.0',
    nodeEnv: 'production',
    os: 'Windows_NT 10.0.19045',
    platform: 'win32',
    arch: 'x64',
    timezone: 'Asia/Shanghai',
    container: false,
    systemUptime: '3天 7小时 12分钟',
    processUptime: '5小时 41分钟'
  },
  adapter: {
    // name 取的是协议端真名（LLOneBot / NapCat.Onebot 这类），不是平台名
    name: 'LLOneBot',
    version: '8.1.8',
    platform: 'QQ',
    protocol: 'llonebot',
    standard: 'onebot11',
    communication: 'webSocketServer',
    connectedFor: '5小时 39分钟'
  },
  renderer: {
    scale: '1.00x',
    timeout: '60秒',
    multiPage: true
  },
  resources: {
    cpuModel: 'AMD Ryzen 7 5800X 8-Core Processor',
    cpuCores: 16,
    totalMemory: '31.93 GB',
    usedMemory: '18.42 GB',
    memoryUsagePercent: '57.7%',
    processRss: '412.68 MB',
    heapUsed: '186.24 MB'
  },
  concurrency: {
    // 这一格照抄 getApiCacheSnapshot() 经 collectRuntimeReport 格式化后的形状：
    // hitRate 已经是能直接当 CSS width 用的百分数文本，tiers[].detail 已经在 core 拼好，
    // 模板只排版、不算数。给一组「有合并、有失败缓存、有排队」的值，
    // 因为这三格恰好是全 0 时看不出排版问题的地方。
    cache: {
      enabled: true,
      sampled: true,
      hitRate: '78.4%',
      hits: 132,
      coalesced: 47,
      misses: 49,
      entries: 63,
      capacity: 128,
      negativeEntries: 2,
      inflight: 1,
      tiers: [
        { label: '准静态接口', hitRate: '96.2%', detail: '命中 48 · 合并 2 · 未命中 2 · 缓存 4 条' },
        { label: '作品详情', hitRate: '73.1%', detail: '命中 84 · 合并 45 · 未命中 47 · 缓存 59 条' }
      ]
    },
    download: {
      limit: 8,
      // 桶名在 core 就换成中文了，模板拿到的已经是「抖音」而不是 douyin
      buckets: [
        { label: '抖音', running: 3, queued: 0 },
        { label: '哔哩哔哩', running: 2, queued: 5 },
        { label: '小红书', running: 0, queued: 0 }
      ]
    }
  },
  releaseNotes: {
    // 这块是按 markdown 渲染的，所以给真实的 release-please 切片形状：
    // 一个 `##` 版本标题 + 若干 `###` 分类小标题 + 带 commit 链接的列表项。
    // 单行文本看不出标题层级、列表缩进和长链接换行这些真正容易崩的排版。
    markdown: [
      '## [2.39.3](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.39.2...v2.39.3) (2026-08-25)',
      '',
      '',
      '### 🐛 Bug 修复',
      '',
      '* **dev:** 开发面板 host 钉成 IPv4，localhost 解析到 ::1 导致打不开 ([77e7636](https://github.com/ikenxuan/kkkkkk-10086/commit/77e7636b1c0d4e2a9f3b5c7d8e0a1b2c3d4e5f60))',
      '* **ci:** issue 自动回复换用官方 github-script，原 action 已被封禁 ([8d82c21](https://github.com/ikenxuan/kkkkkk-10086/commit/8d82c21fdf1fcc0d50670646857d7dcd92baf0a1))',
      '',
      '',
      '### ✅ 测试',
      '',
      '* **db:** 保留期用例改批量插入，CI 上不再超时 ([83603a4](https://github.com/ikenxuan/kkkkkk-10086/commit/83603a4d22b184045de169ae419e9c10915411fb))',
      '',
      '',
      '### 🤖 CI/CD 配置',
      '',
      '* Node 版本钉到 24，action 升到自身跑 node24 的版本 ([73b41ee](https://github.com/ikenxuan/kkkkkk-10086/commit/73b41ee3d670e6f530345b82029b8cf5ea840535))'
    ].join('\n'),
    available: true
  }
}
