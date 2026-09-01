# 上游对齐记录

本仓是 [`ikenxuan/karin-plugin-kkk`](https://github.com/ikenxuan/karin-plugin-kkk)（karin 生态）的云崽移植。两边在同一批平台代码上持续分叉，这份文件是**「已对齐到此」的唯一记录**。

按平台分行而不是记一个全局 sha：各平台进度天然不一致。

「上游 sha」指**上游该平台目录最后一次改动的 commit**，不是上游 HEAD。对齐时以它为准，因为该平台在那之后没有新变化。

## 对齐表

| 平台 | 上游 sha | 上游日期 | 上游版本 | 本仓 commit | 对齐范围 |
|---|---|---|---|---|---|
| bilibili | `6e557ec3` | 2026-08-18 | 2.42.2 | `3be55569` `2669ab0d` | 调用形态已对齐：中文方法名映射删除，全部调用点改走 amagi v6 英文 fetcher。`-352` voucher 提取已合并成一处、路径扩到 8 条（见下），但真实 voucher 位置仍未确证 |
| douyin | `4772801d` | 2026-08-29 | 2.42.2 | `3be55569` | 调用形态已对齐，同上。`live-room.ts` 的两步补号时序是本仓设施，上游无对应物 |
| kuaishou | `f4b0c23e` | 2026-08-17 | 2.42.2 | `3be55569` | 调用形态已对齐，同上。`getdata.ts` 的 `KUAISHOU_METHODS` 常量表是本仓设施 |
| xiaohongshu | `da7bfd2d` | 2026-08-18 | 2.42.2 | `3be55569` | 调用形态已对齐，同上。上一次同步（`docs/superpowers/plans/2026-08-19-xiaohongshu-v2421-sync.md`）只记了版本号 `v2.42.1` 没记 sha，无法判定同步到了哪一刻，这份表从本次起补上 |

上游基准：HEAD `4772801d`（2026-08-29），分支 `main`，工作树干净。

## 刻意不跟上游的地方

下一轮同步**不要**把这些当成「落后」再改回去。

### 1. UA 守卫（四平台共用，唯一一处刻意分叉）

上游 `amagiClient.ts` 是直接透传：`headers: { 'User-Agent': amagi['User-Agent'] }`。

本仓保留 `buildSharedUserAgentHeader()`：**只在配置 UA 比所有平台 amagi 内置的都新时才覆盖**，否则交回 amagi 自己决定。

理由：amagi 的 `Sec-Ch-Ua` 是从 UA 派生的，UA 落后会让整组客户端提示自相矛盾，而 B站 gaia 风控（`-352`）看的正是这个。这不是假设——首次安装时 `config/config/request.yaml` 被写死后升级插件不覆盖，本机那份锁在 Chrome/125，而 amagi 内置 bilibili 是 142。照上游丢掉守卫，本机的 B站 请求 UA 会当场从 142 掉回 125。

阈值取四平台内置里最高的那个（douyin 125 / bilibili 142 / kuaishou 130 / xiaohongshu 141），因为共用客户端不知道这次请求走哪个平台。

### 2. amagi 本体版本

| | 形态 |
|---|---|
| 上游 | git submodule `packages/amagi`，pin `6996c48a`，`workspace:*` 链进去（**该 submodule 本地未 checkout**，读不到上游在用的源码） |
| 本仓 | 发布版 `^6.5.0`，实装 6.5.0 |

所以能对齐的是**调用形态与错误语义**，不是 amagi 本体版本。

### 3. `softFetch` 白名单

本仓 `SOFT_ERROR_CODES.bilibili` 是 `[12061, 12002]`，上游只有 `12061`。归「纯分叉」，不动。

### 4. 移植设施（本仓有、上游没有的文件）

为云崽宿主或发布版 amagi 而加，**不要照上游删**：

- bilibili：`amagi-runtime` `article` `cdn` `dynamicText` `live-stream` `richtext-message` `types`
- douyin：`listCard` `live` `live-room` `pushPreview` `render`
- xiaohongshu：`link` `livePhoto`

## 待查：推送路径的空 cookie（本仓与上游的一处语义分叉）

`platform/bilibili/push.ts` 的 `getdata()` 里，拉视频动态稿件信息的 `fetchVideoInfo` 第二个实参是 `''`，也就是**不带 cookie**：

```ts
await bilibiliFetcher.fetchVideoInfo({ bvid, typeMode: 'strict' }, '', buildAmagiRequestConfig())
```

上游同一处（`packages/core/src/platform/bilibili/push.ts:470`）是：

```ts
await bilibiliFetcher.fetchVideoInfo({ bvid, typeMode: 'strict' })
```

看着只是少传两个参数，实际语义相反，因为两边的 `bilibiliFetcher` 不是同一个东西：

| | `bilibiliFetcher` 是什么 | cookie 从哪来 |
|---|---|---|
| 上游 | `amagiClientInstance.amagi.bilibili.fetcher`，取自用 `Client({ cookies })` 建出来的实例 | **实例自带**，调用点不传 |
| 本仓 | `require('@ikenxuan/amagi').bilibiliFetcher`，模块级裸导出，没有绑定任何实例 | **只能由调用点显式传**，不传就是没有 |

所以上游那一行发的是配置里的 B站 cookie，本仓这一行发的是空 cookie。

本仓其余 B站 调用点都显式传了 `Config.cookies.bilibili`，只有三处是 `''`：
`push.ts` 的 `fetchVideoInfo`（推送路径），以及 `bilibili.ts` 里 one_video 与 dynamic_info 两条支线的 `fetchComments`。

（这里刻意不写行号：先前写死的 `:390` / `:485` / `:644` 在几轮注释清理后已经全部漂掉。按方法名找。）

**这不是 `3be55569` 改出来的**：`''` 从最初的云崽移植（`0471487d`）就在，那次移植把上游的
「实例带 cookie」换成了「裸 fetcher + 显式传参」，而这几处没有跟着补上 cookie。

**为什么值得记而不是直接改**：真机证据里撞 `-352` 的正是推送路径，而未登录请求本就是 gaia 风控
盯的形状。但 `fetchVideoInfo` 带不带 ck 可能影响返回的画质档位，同一处还留着一行注释掉的
「无 ck 对照」代码（紧跟在 `fetchVideoInfo` 下面那行 `noCkData`），说明当初可能是有意为之。**没有测试覆盖「带不带 ck」的差异**，
所以改之前需要先确认，不能顺手加。

## `-352` voucher：已做与未决

**已做**（`2669ab0d`）：提取口合并成 `platform/bilibili/riskVoucher.ts` 一处，候选路径扩到 8 条。

合并前 `Base.ts` 的闸门只认 2 条、`riskControl` 的策略认 4 条，口径不一致：voucher 落在闸门不认的路径上时，用户先收一张「接口失败」卡、再被要求扫码。

**已做**（`145d6bf8`）：取不到 voucher 时把信封的**键名**落进日志，见 `utils/amagiClient.ts` 的 `logRiskControlShape`。只记键名不记值（里面可能有 cookie 指纹）。放在 amagi 客户端而不是 `riskControl`：后者的 `match` 要求 voucher 非空，没有 voucher 的 -352 根本进不到它的 handle，日志写在里面等于永不执行。

**未决**：真实 -352 响应体究竟把 voucher 放在哪，**仍未确证**。-352 不能按需复现，所以 8 条路径是刻意撒网而不是对某一条的判断；实测拿到的 -352 信封只有 `{code, message, ttl}`，连 `data` 都不存在。下一次真撞上时，靠上面那条日志读键名收口。

另需注意：推送路径的 `-352` **永远**到不了 `riskControl`——定时任务没有事件对象，而 `Base.ts` 和 `riskControl` 两道闸门都要求 `Boolean(event)`。那条路上二维码没有收件人，不是缺陷而是路径性质。修 voucher 只对解析路径有效。
