# 上游对齐记录

本仓是 [`ikenxuan/karin-plugin-kkk`](https://github.com/ikenxuan/karin-plugin-kkk)（karin 生态）的云崽移植。两边在同一批平台代码上持续分叉，这份文件是**「已对齐到此」的唯一记录**。

按平台分行而不是记一个全局 sha：各平台进度天然不一致。

「上游 sha」指**上游该平台目录最后一次改动的 commit**，不是上游 HEAD。对齐时以它为准，因为该平台在那之后没有新变化。

## 对齐表

| 平台 | 上游 sha | 上游日期 | 上游版本 | 本仓 commit | 对齐范围 |
|---|---|---|---|---|---|
| bilibili | `f9932f8d` | 2026-09-03 | 2.42.4 | `3be55569` `2669ab0d` +本次 | 调用形态已对齐：中文方法名映射删除，全部调用点改走 amagi v6 英文 fetcher。`-352` voucher 提取已合并成一处、路径扩到 8 条（见下），但真实 voucher 位置仍未确证。opus `node_type: 4` 站内图文链接已跟进 |
| douyin | `3cf285ae` | 2026-09-01 | 2.42.3 | `3be55569` `097807a0` `6d348d8c` | 调用形态已对齐。**扫码登录已跟到 passport 接口**（见下）。`live-room.ts` 的两步补号时序是本仓设施，上游无对应物 |
| kuaishou | `f4b0c23e` | 2026-08-17 | 2.42.3 | `3be55569` | 调用形态已对齐，同上。`getdata.ts` 的 `KUAISHOU_METHODS` 常量表是本仓设施 |
| xiaohongshu | `da7bfd2d` | 2026-08-18 | 2.42.3 | `3be55569` | 调用形态已对齐，同上。上一次同步（`docs/superpowers/plans/2026-08-19-xiaohongshu-v2421-sync.md`）只记了版本号 `v2.42.1` 没记 sha，无法判定同步到了哪一刻，这份表从本次起补上 |
| 渲染 / 模板 | `ac96199` `e498c5f` | 2026-09-03 | 2.42.4 | 本次 | 隐水印整套删除、页脚版本信息强制常显；登录二维码中心嵌触发者头像 |

上游基准：HEAD `f9932f8d`（2026-09-03，v2.42.4），分支 `main`。

### 本轮扫描：`c5512ace..f9932f8d` 共 5 个提交，3 个已移植

| 提交 | 处置 |
|---|---|
| `ac96199` 移除 `@ikenxuan/watermark`，图片强制展示底部版本信息 | **已移植**，见下 |
| `e498c5f` 登录二维码加触发者头像 | **已移植**，见下 |
| `f9932f8` B站 opus 站内图文链接节点 + 图标 | **已移植**，见下 |
| `ee8bc51` 二维码链接拼接错误 | **无需移植**。它修的 `https://c/aweme/v1/play/` 截断域名本仓从来没有过：`videoQuality.ts` 的 `buildDouyinPlayUrl` 早就改用 `URLSearchParams` 且域名恒为 `aweme.snssdk.com`（那处注释里记了当初为什么改）。另一半是上游自己的 `@template/` 路径别名修正，与本仓无关 |
| `cae3f7a` release 2.42.4 | 只动 `.release-please-manifest.json` / `CHANGELOG.md` / `package.json` |

### 隐水印移除（`ac96199` → 本次）

上游把 `@ikenxuan/watermark` 整套删了，页脚版本信息从「可关」改成强制常显。本仓完整跟进：

- 删 `src/module/utils/Watermark.ts`、`@ikenxuan/watermark` 依赖、`tests/watermark*.test.ts`
- 删配置项 `app.RemoveWatermark`（`types/config.ts`、两份 `app.yaml`、锅巴面板那一栏）
- 删 `ctx.watermarkTextBitSize` 与页脚的 `Restore ID`
- `Render()` 现在一律注入 `ctx.version`，成图**原样返回**

`Watermark.ts` 里那三样和水印无关的东西（`ImageMessage` / `readImageBytes` / `replaceImageBytes`）搬进新的叶子模块 `src/module/utils/imagePayload.ts` —— 分片（`imageSlicer`）、抖音扫码登录落盘、live photo 提示图三处都要读写消息段里的图片字节，和水印不是一回事。

**顺带确认了一件事**：成图那圈透明圆角现在没有任何再编码环节了。截图侧本来就是 `imgType: 'png'` + `omitBackground: true` + `multiPage: false`（宿主见到 multiPage 为真会把编码覆盖成 jpeg，见 `imageSlicer.ts` 开头），分片走自己的 sharp。这一点本仓**领先上游**：上游仍在用宿主的 multiPage。

### 登录二维码头像（`e498c5f` → 本次）

三个二维码模板（`bilibili/qrcodeImg`、`douyin/qrcodeImg`、`other/qrlogin`）从 `generateQRCode` 换成已有的 `QRCodeWithAvatar` 组件，契约加可选字段 `avatarUrl`。

**一处刻意不照抄**：上游 `resolveTriggerAvatarUrl` 走 `e.bot.getAvatarUrl(userId)`（karin 的适配器统一接口，是个 async RPC）。本仓没有这个接口，改成同步的 `src/module/utils/avatar.ts`：按纯数字 QQ 号拼 `q1.qlogo.cn`，openid 一律返回 undefined 让二维码退化成普通二维码。判据与 `pushList.ts` 的 `groupAvatarUrl`、`userRanking.ts` 的 `userAvatarUrl` 一致（后者已改为复用同一个 helper），取号次序与 `ErrorHandler/render.ts` 的 `resolveUserId` 一致（`user_id` 优先、退回 `sender.user_id`，只认 snake_case）。不发 RPC 的取舍同 `userRanking.ts` 里那条注释：塞一个必然 404 的地址会让模板侧 `loadQRCodeAvatar` 等 5 秒超时。

形参类型是 `Pick<MessageEvent, 'user_id' | 'sender'>`，从本仓对宿主事件的镜像上取，不自己编形状；两个 login 的窄事件接口都 `extends` 它。**没有**读 `sender` 上的头像字段 —— `@types/trss-yunzai` 的 `GroupMessage.sender` / `PrivateMessage.sender` 逐字段声明过，里面没有这一项。

### B站 opus 站内图文链接（`f9932f8` → 本次）

`node_type: 4` 是 opus 正文里的高亮链接（官方页面的 `opus-text-rich-hl`）。此前解析器只认 `node_type === 1`、其余 `return []`，那段正文在卡片上凭空消失。

新增 `opusLink` 节点贯穿四层：`richtext/types.ts` 的类型与渲染选项、`richtext/parse` 的 `createOpusLinkNode` 与纯文本提取、`ktr/richtext/react` 的 `OpusLinkIcon` 与渲染分支、`dynamicText.ts` 的解析与合并转发文本。缺跳转地址时退化成普通文本节点。

### 抖音扫码登录（`3cf285ae` → 本仓 `6d348d8c`）

**这是本表第一次真的动 amagi 本体版本**（`^6.5.0` → `^6.6.0`，本仓 `097807a0`）。此前一直写着「能对齐的是调用形态与错误语义，不是 amagi 本体版本」——那条仍然成立，只是这次上游用的接口恰好已经发布到 npm，所以够得着。

升级前逐条验过爆炸半径：抖音 fetcher 19→23 个方法，新增的正是那四个 passport 方法，**零删除零改名**；其余三平台方法数不变；四平台内置 Chrome 主版本两版完全一致，所以 UA 守卫那四个阈值不用动。

**两处刻意不照抄上游**：

1. 四个 passport 方法走本仓包过的 `douyinFetcher`，不是上游那样直接引模块级裸函数。上游的 fetcher 取自 `Client({ cookies })` 建出来的实例，本仓是模块级裸导出 + 自己的包装层（见「amagi 本体版本」一节）。照抄的后果是失败从「抛 `AmagiError`」退化成「返回 `success: false`」，不显式检查就静默拿到 undefined。
2. `isSmsCodeVerifyWay` 经 `amagiClient` 惰性转口。直接 `import { isSmsCodeVerifyWay } from '@ikenxuan/amagi'` 会让整个测试文件在 **Vite 解析阶段**就 `packageEntryFailure`（amagi 的 exports map 里 `development` 条件指向未发布的 `src/index.ts`），`vi.mock` 根本来不及生效——实测「Tests no tests」。

**顺带删掉四个死依赖**：`puppeteer` 与 `fingerprint-injector` 随本次移植失效；`sequelize` 源码里从未出现过；`simple-git` 在 `f54ed6d8` 删 art-template 时连代码一起删了、`package.json` 漏跟。

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

- bilibili：`article` `cdn` `dynamicText` `live-stream` `richtext-message` `types`
- douyin：`listCard` `live` `live-room` `pushPreview` `render`
- xiaohongshu：`link` `livePhoto`
- utils：`imagePayload`（消息段图片字节读写，隐水印删除后留下的那部分）、`avatar`（触发者头像，替上游那个 async 的 `e.bot.getAvatarUrl`）

`platform/bilibili/amagi-runtime` 曾在这张清单上，**已删除**：它存在的理由是那份手写的枚举兜底副本要能被契约测试单独 import，而副本本身跟上游一样不该有 —— 没有任何编译期约束，上游改名后它会安静地把对应类型的动态从推送里抹掉。现在枚举统一由 `utils/amagiClient.ts` 的 `loadAmagiEnums()` 取，require 失败就抛（amagi 在 `dependencies` 里，装不上就是坏安装），`bilibili.ts` 里那份重复的 loader 也一并合掉。

`tests/contracts/amagi-enums.test.ts` 相应只剩「全仓读到的每个成员在真包里都真实存在」这一半 —— 那才是真正在守的东西。挡掉 `amagiClient` 的单测要在工厂里补一项 `loadAmagiEnums`，用 `tests/helpers/amagi-enums.ts` 里的真包加载器，别手写副本。

### 5. `AmagiError.message` 不塞 `util.inspect`

上游 `amagiClient.ts` 把 `util.inspect({ code, data, message, error }, { depth: 10, colors: true, showHidden: true })` 的结果整段塞进 `AmagiError.message`。

本仓只放人读的那一句（见 `utils/amagiClient.ts` 的 `toAmagiError`）。两个理由：

1. `colors: true` 的 ANSI 转义进了错误卡片的 HTML 就是一串乱码；
2. 那个 message 还会流进发给触发者的 `处理失败：...` 纯文本回复和 `softFetch` 的 `SoftFailureResult`，用户会收到一大坨 dump。

信封里的结构化字段改由 `ErrorHandler/diagnostics.ts` 的 `collectApiDiagnostics` 摊成键值对，走模板的故障详情区 —— 两条出卡路径共用，信息量不比上游少。

### 6. amagi 层的出卡口：只剩无事件的推送路径

上游 `Base.ts` 里没有 amagi 的 Proxy、没有出卡逻辑，失败一律 `throw` 交给 `wrapWithErrorHandler`。本仓曾在 fetcher Proxy 里自己渲卡 + `event.reply`，于是同一个失败被上报两次（那张只有接口信封，ErrorHandler 那张才带日志与堆栈）。

现在已经收回上游形状：**有事件一律原样抛**。保留的部分只有事件为空那一支 —— 定时推送没有事件对象，ErrorHandler 走 `getBotId(ctx.event)` 一张卡也发不出去，`sendMasterMessage` 是它唯一的告警出口，这是云崽宿主特有的、上游不需要。

下一轮同步不要把这一支也删掉。

也不要顺势把 `Base` 改成上游的 `class Base extends AmagiBase`：那个基类是为「持有 `Client({ cookies })` 实例」而存在的，而本仓的 fetcher 是模块级裸导出、cookie 由调用点显式传（见上面那节），没有实例状态可继承。反过来，保留下来的推送出卡口需要 `self.e` 与 `self.pushContext` 两样**每实例**的东西（发给谁、印不印群号），它们进不了模块级单例 —— 所以那层包装只能待在构造函数里。

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
