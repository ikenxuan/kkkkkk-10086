# React 模板移植到 Yunzai 实施计划

> 日期：2026-08-17
> 目标仓库：`E:\Yunzai\plugins\kkkkkk-10086`
> 上游基线：`ikenxuan/karin-plugin-kkk@feat-template-react` (`860fea2`)
> 原则：HTML/React 模板体系沿用上游；截图只由 Yunzai 本体 Puppeteer 完成；运行时不依赖 `node-karin`。

## 一、边界与非目标

### 必须保留

- 现有公开调用方式：`Render(templatePath, params)`。
- Yunzai 本体 `lib/puppeteer/puppeteer.js` 的 `screenshots(name, data)` 截图链。
- 现有主题、`renderScale`、超时、分页、水印和 `false` 失败语义。
- Miao-Yunzai / TRSS-Yunzai 的消息段兼容。
- 根目录 `guoba.support.js -> lib/guoba.support.js` 的命名导出与锅巴 Schema 配置协议。
- 未迁移或暂不支持的路由继续使用旧 art-template HTML，避免一次性破坏全部调用方。

### 明确不移植

- `node-karin.render`、`segment.image`、`karinPathHtml`、Karin `Message`、Karin DB 更新锁。
- Karin Web 管理面板；锅巴仍使用 JSON 可序列化的 Schema，不嵌入 React/Vue 组件。
- 在用户机器上运行时编译 TSX；发布产物必须包含可直接加载的模板注册表和 CSS。

## 二、目标架构

```text
ktr/template/**/*.tsx
        │
        ├── scripts/generate-template-registry.mjs
        │        └── .generated/template-registry.ts（确定性、可审计）
        │
        └── Vite SSR 构建 + Tailwind CSS
                 ├── lib/template-registry.js
                 ├── lib/template-style.css
                 └── lib/template-assets/**

Render(path, params)
        │
        ├── React 路由存在
        │      └── 项目内 ReactTemplateRenderer
        │             ├── React 19 renderToReadableStream 生成安全 HTML
        │             ├── CSS 内联
        │             ├── 模板与编译 CSS 资源分别改写为 file URL/data URI
        │             └── resources/react-template/bridge.html 以 raw 变量接收完整 HTML
        │
        └── React 路由不存在或生成失败（按兼容策略）
               └── 原 resources/template/**/html/*.html

两条路径最终都调用：Yunzai host puppeteer.screenshots(...)
```

## 三、实施步骤（测试先行）

### Task 1：冻结注册表和构建契约（RED）

新增：

- `tests/contracts/react-template-build.test.ts`
- `tests/unit/react-template-renderer.test.ts`

先写失败断言：

1. 注册表路由为确定性排序，包含上游全部海报路由。
2. 旧调用别名（至少 `douyin/videoInfo -> douyin/video-work`）可解析。
3. 未知/管理路由（例如 `admin/index`）明确返回 legacy 分支。
4. React SSR 会转义 `</script>`、HTML 标签和属性载荷，不通过字符串拼接注入数据。
5. 输出 HTML 有唯一 `#container`，内联构建 CSS，并能安全解析本地资源。
6. `package.json` 的 build/pack 产物必须包含注册表与样式；运行时依赖中不得出现 `node-karin`。

运行单测并确认 RED 原因是实现/产物缺失，而不是测试自身错误。

### Task 2：移植模板源码与最小模板 SDK

新增：

- `ktr/template/**`：从上游 `packages/core/ktr/template/**` 移植。
- `ktr/font/**`：模板字体声明。
- `src/template-sdk/index.ts`：项目内 `defineTemplate`、上下文和注册表类型。
- `src/template-richtext/**`：移植上游 `packages/richtext/src/**`。

处理：

- 将模板对 `@karinjs/template-react` 的运行时引用替换/别名到项目内 SDK。
- 将 `@kkk/richtext` 映射到项目内富文本实现。
- 将页脚中的 `Karin` 信息替换为 `Version.BotName` / `Version.BotVersion` 注入值。
- 保留 React 组件数据形状，避免在组件层重新设计上游模板。

### Task 3：确定性注册表生成与 SSR 构建

新增：

- `scripts/generate-template-registry.mjs`
- `vite.template.config.ts`
- `tsconfig.template.json`
- `.generated/template-registry.ts`（如发布流程需要则提交生成物，否则由 build 前强制生成并做漂移测试）。

要求：

- 只识别 `ktr/template/**/index.tsx`，忽略 `_preview`。
- 路由使用 POSIX 分隔符并字典序排序。
- 构建为 Node ESM SSR 注册表；React/ReactDOM 保持单例。
- Tailwind/主题基础 CSS 在构建期生成，不在机器人启动时运行 Vite。
- 发布包包含运行时所需 JS/CSS/资源清单。

### Task 4：项目内 HTML 生成器

新增建议：

- `src/module/utils/react-template/registry.ts`
- `src/module/utils/react-template/html.ts`
- `src/module/utils/react-template/assets.ts`
- `src/module/utils/react-template/index.ts`

职责：

- 动态导入已构建注册表。
- 使用 React 19 `renderToReadableStream()` 渲染 `{ data, ctx }`，等待 `stream.allReady` 后读取完整 HTML。
- 使用 React 自身转义保证数据安全。
- 生成完整 HTML 文档并内联 CSS。
- 将有限正数 `scale` 统一应用在 SSR 外层 `#container` 的 CSS `zoom` 上，并在该容器设置 `isolation:isolate`；非法值、`0`、负数和无穷值回退为 `1`，模板组件不得再次缩放，避免出现 scale²。
- 模板标记资源限制在插件 `resources` 目录内，编译 CSS 资产限制在 `lib` 目录内，均拒绝 `..` 逃逸。
- 默认只内联不超过 4 KiB 的小资产；构建字体使用 `file://`，避免每张海报重复生成数 MiB base64。
- 缓存已加载样式、CSS 资源改写和静态资产改写结果，避免并发渲染重复同步读取字体与 CSS。
- 不写临时 HTML 文件；将完整 SSR HTML 作为数据传给固定 raw bridge，避免并发文件覆盖与残留清理。
- 返回 `{ route, html }`，错误由注册表/Render 边界保留可诊断原因。

### Task 5：接入现有 Render 与 Yunzai Puppeteer

修改：

- `src/module/utils/Render.ts`
- 必要时 `src/runtime/host/puppeteer.ts`（仅扩充本体类型，不替换实现）。

流程：

1. 标准化逻辑路由并查 React 注册表。
2. 构造 Yunzai 上下文：scale、主题、插件版本、Bot 名称/版本、水印比特数；`scale` 只接受有限正数并由 SSR 外壳统一缩放。
3. React 路由先生成静态 HTML，将 `tplFile` 固定指向 `resources/react-template/bridge.html`，并通过 `{{@ ssrHtml}}` 原样插入完整文档。
4. `multiPageRender !== false` 时调用 `puppeteer.screenshots()`；显式关闭分页时调用 `puppeteer.screenshot()` 并统一包装为数组。两种宿主方法返回 `false` 都直接保留失败语义。
5. React 路由不可用或 SSR 生成失败时记录一次明确警告并回退 legacy；截图阶段异常不触发二次 legacy SSR，未知路由直接走 legacy。
6. 截图结果继续经过现有 `applyWatermarkToImages`。

### Task 6：路由/调用方兼容

- 建立显式别名，不做模糊猜测。
- 首批保证当前所有同名路由可用。
- 对数据模型确实变化的路由，依据上游调用点逐个改造，配回归测试。
- `admin/index` 等上游无 React 版本的模板保留 legacy。
- 完成后对每个注册路由至少做注册/SSR 级烟测；代表性路由做 Puppeteer 截图烟测。

### Task 7：资源与字体

- 先核对当前 `resources` 的已跟踪/已修改状态，不覆盖用户的无关改动。
- 只补充 React 模板实际缺失的 upstream resources。
- HTML 生成器分别约束模板资源根（`resources`）和编译 CSS 资源根（`lib`）；网络资源保持 URL。
- 字体路径同时在 Windows、Linux 和 `file://` 场景验证。

### Task 8：锅巴适配和文档

保留：

- `supportGuoba()` 命名导出。
- `pluginInfo.name === 'kkkkkk-10086'`。
- Schema 字段、`getConfigData` 和 `setConfigData` 的现有映射。
- pushlist 变更后的数据库同步。

仅在出现真实用户选项时新增 Schema；React 模板本身不需要伪造一个锅巴开关。文档说明：

- 锅巴只负责配置，React 只负责海报。
- 普通安装者不需要 Node 端编译 TSX。
- Miao/TRSS 的最低版本、Node 版本、构建/开发命令和回退策略。

## 四、验证矩阵

每个阶段运行最小测试，收尾运行：

```text
pnpm lint
pnpm typecheck
pnpm typecheck:template
pnpm typecheck:test
pnpm test
pnpm test:baseline
pnpm build
pnpm test:dist
pnpm verify
```

额外验证：

- `npm pack --dry-run --json` 中存在 `lib/template-registry.js`、`lib/template-style.css`、`lib/template-assets/**`、raw bridge 和字体许可声明；当前 pnpm 9 不支持 `pnpm pack --dry-run`。
- 在无 `ktr/` 源码的临时发布目录中仍可 SSR。
- 代表性路由：help、Bilibili 动态、抖音视频/评论、小红书笔记、统计页。
- 恶意字符串不会突破 HTML 文本/属性边界。
- `admin/index` legacy 回退仍可截图。
- 锅巴入口加载无数据库、app loader、HTTP server 副作用。
- `tests/contracts/react-template-dist.test.mjs` 必须导入真实构建产物、渲染 `other/help`，并验证 35 个路由、17 个字体 URL、doctype、资源路径和小于 2 MiB 的 HTML。

## 五、风险控制

- 工作区已有大量未提交迁移内容；只审查/修改本计划列出的任务文件，不清理工作树。
- 不整体覆盖 `resources`；新增资源前先确认冲突。
- React/ReactDOM 必须由同一运行时实例完成组件与 SSR，避免 hooks dispatcher 为空。
- 构建产物与源码注册表必须有漂移测试，避免“本机可用、发布包缺文件”。
- legacy 回退在完整路由烟测通过前不得删除。

## 六、Karin standalone 构建文档对照

参考：<https://karinjs.github.io/template-react/docs/build/standalone-build/>

官方 standalone 契约面向可被任意 Node ESM 宿主直接消费的模板包，典型产物为单入口 `dist/ktr/index.mjs`、精确路由数据声明 `index.d.mts` 和可选 `assets/`；它公开 `renderTemplate()` / `createTemplateRenderer()`，并把 Registry、SSR runtime 和 CSS 组合在单入口中。

本项目是面向 Yunzai 的内部运行时移植，以下差异是有意设计，不宣称可直接替代 Karin 官方 standalone 包：

- 产物拆为 `lib/template-registry.js`、`lib/template-style.css`、`lib/template-assets/**` 和 `lib/module/utils/react-template/**`。
- React/ReactDOM 是插件正式运行依赖，由内部 renderer 使用；根入口不公开 standalone `renderTemplate()`。
- 调用边界仍是历史兼容的 `Render(templatePath, params)`，截图只交给 Yunzai 本体 Puppeteer。
- 当前不发布路由到 data 的 `.d.mts` 公共类型映射；模板源码通过 `tsconfig.template.json` 做内部类型检查。
- CSS 独立输出是为了让 Yunzai renderer 缓存一次并在 SSR HTML 中内联；字体资产保留为包内 `file://` URL。

这些差异不影响插件运行，但若未来要把模板作为第三方 npm SDK 发布，应单独实现官方单入口与声明生成，而不是让 Yunzai 运行路径承担两套公共契约。

## 七、并发解析与表情回应

- `ParseScheduler` 使用可配置并发数、FIFO 和任务指纹共享 Promise；同一解析任务不会重复占用队列。
- `ParseCoordinator` 以 URL、平台和会话仲裁唯一赢家，只有赢家执行解析和表情状态更新。
- 海报渲染与视频发送使用 `Promise.allSettled` 并行收口，任一分支失败不会取消另一分支。
- Amagi 每次尝试最多 60 秒，超时会中止当前请求并按网络错误策略重试；每次尝试使用独立 `AbortSignal`。
- 表情回应优先调用宿主原生 `setMsgReaction`；协议识别沿用云崽状态页使用的规范标签：优先 `bot.apk.display/version`，并把只有名称的 `bot.version.app_name` 作为独立协议标签，再参考 `bot.version.version` 和适配器 id/name/platform。
- 只有明确识别协议实现时才调用一次 `sendApi`，失败不换 action 探测。

协议路由：

| 实现 | Action | 关键参数 |
| --- | --- | --- |
| Milky / LLOneBot Milky | `send_group_message_reaction` | `group_id`, `message_seq`, `reaction`, `reaction_type: face`, `is_add` |
| NapCat / LLOneBot OneBot v11 | `set_msg_emoji_like` | `message_id`, `emoji_id`, `set` |
| Lagrange.OneBot | `set_group_reaction` | `group_id`, `message_id`, `code`, `is_add` |
| SnowLuma | `set_group_reaction` | `group_id`, `message_id`, `code`, `is_set` |

NapCat 的 `fetch_emoji_like` 只读取已有回应详情，不用于添加或移除回应。未知 OneBot 实现直接返回不支持，避免一条消息因多 action 探测被重复回应。

## 八、Karin template-react AI Skill 文档对照

参考文档：

- AI Skill 说明：<https://karinjs.github.io/template-react/docs/ai-skill/>
- Skill 源文件：<https://github.com/KarinJS/template-react/blob/main/skills/karin-template-react/SKILL.md>
- 全量文档：<https://karinjs.github.io/template-react/llms-full.txt>

### 8.1 给 AI/子代理的标准工作流

官方 Skill 的核心要求是：`template-react` 迭代较快，接入、迁移和排错前不能依赖模型记忆，必须先读取最新文档，再开始修改代码。安装官方 Skill 的命令为：

```bash
npx skills add KarinJS/template-react@karin-template-react
```

Skill 使用 Node.js 18 或更高版本的无依赖脚本拉取文档：

```bash
node <skill目录>/scripts/fetch-docs.mjs
node <skill目录>/scripts/fetch-docs.mjs quick-start
node <skill目录>/scripts/fetch-docs.mjs guide/template
node <skill目录>/scripts/fetch-docs.mjs --list
```

脚本优先读取文档站的 `llms-full.txt` 或单页 `content.md`，失败时再回退到 GitHub 原始文件。AI 完成代码后，应再次按同一份文档逐项自查，而不是只验证 TypeScript 能否通过。

### 8.2 官方模板约定

- 模板必须放在 `ktr/template/<板块>/<模板>/index.tsx`，默认导出 `defineTemplate({...})`；裸的 `foo.tsx` 不会被注册为路由。
- `components/` 和以下划线开头的目录用于模板内部或共享代码，不应被当成公开模板路由。
- TypeScript mock 固定放在模板同级 `mock.ts`，使用具名导出和 `satisfies`；它主要用于面板预览。
- JSON mock 必须放在模板同级的 `data/*.json`；同名数据存在时 JSON 优先于 TypeScript mock。
- `data/captured.json` 用于保存真实渲染捕获的 `{ data, ctx }` 快照，面板可以据此刷新并选中数据。
- 组件根节点不要写 `id="container"`；截图边界由框架包装器提供。根节点圆角使用 `rounded-*`，需要裁切时配合 `overflow-hidden`。
- `style.css` 的官方入口约定为三行：`@import 'tailwindcss'`、`@import '@karinjs/template-react/styles'` 和 `@source './**/*.{ts,tsx}'`。
- 颜色优先使用 HeroUI 语义类，例如 `bg-background`、`text-foreground`、`bg-surface`、`text-muted`、`text-accent`、`border-border` 和 `bg-success/warning/danger`；不要把 `bg-white` 或 `text-zinc-500` 等固定色当成主题系统。
- 不要重新添加旧版的普通 `@theme` 颜色映射块。官方 HeroUI 桥接使用 `@theme inline`，旧映射会把主题变量固化到 `:root`，导致元素级换肤失效。
- 深色判断读取 `ctx.theme?.mode`；圆角、字体和其他主题变量通过 `ThemeContext`/`theme.vars` 传递。

### 8.3 官方构建与渲染边界

- 胶水层通常由 `createTemplateRenderer(import.meta.url, ...)` 装配，再由插件自己的 `renderImage(route, data, options?)` 统一出图。
- 官方同时支持两种生产构建：普通打包器模式在 Vite、tsdown 等 bundler 中挂载 `ktrBuildPlugin()`；不希望维护宿主打包入口时可使用 `ktr build` 生成 standalone Node ESM 运行包。
- `ktrBuildPlugin()` 会把 CSS、`assets/` 和注册表一起纳入下游打包器产物；standalone 模式则把 CSS 内嵌到 `dist/ktr/index.mjs`，并生成精确路由声明。两者的产物协议不可混用。
- 本项目没有采用官方 CLI/runtime 作为生产依赖，而是用本地 Vite 配置生成 Yunzai 专用的拆分产物；这是宿主边界选择，不能表述成上游不存在 `ktr build`。
- React、ReactDOM、模板运行时和组件库必须保持同一份 React 副本。重复打包 React 会导致 hooks dispatcher 错误。
- 只有 `node-karin` 属于宿主侧依赖；模板包自身应携带可运行的模板代码、CSS 和资源。

### 8.4 本项目的云崽映射

| 官方 Karin 约定 | 本项目 `kkkkkk-10086` 的实现 |
| --- | --- |
| `@karinjs/template-react` runtime | `src/template-sdk/index.ts` 内部 SDK，发布运行时不依赖 `node-karin` 或官方 runtime 包 |
| `ktr sync` 生成注册表 | `scripts/generate-template-registry.mjs` 在 `pnpm template:sync` 和构建前生成 `.generated/template-registry.ts` |
| 官方 standalone/`createTemplateRenderer` | `lib/template-registry.js` + `src/module/utils/react-template/registry.ts`，保留云崽历史 `Render(path, params)` 边界 |
| Karin `renderImage` / `node-karin` 截图 | `Render.ts` 生成 SSR HTML，最终交给云崽本体 Puppeteer `screenshots()` |
| 官方 CSS/资源发现 | `lib/template-style.css`、`lib/template-assets/**` 和插件 `resources/**`，由内部 HTML 生成器按资源根改写 |
| 官方内联阈值 | 小于等于 4 KiB 的资源可内联；字体等大资源使用 `file://`，并缓存 CSS 与静态资源改写结果 |
| 开发面板 mock | 当前发布运行目标只依赖构建后的 registry；模板数据由调用方传入，不能把 `.ktr` 或面板源码当作生产运行时依赖 |
| 官方三行 CSS 入口 | 项目使用 `vite.template-style.config.ts` 产出独立 CSS，并由 Yunzai renderer 注入；新增模板仍需遵守语义色和主题变量约定 |

因此，新增或迁移模板时应同时满足两层契约：模板源码遵守 Karin 的目录、数据、主题和可截图约定；插件接入遵守云崽的 `Render`、Puppeteer、资源路径和发布清单约定。不能在运行时手动 `import` `.ktr` 源码，也不能假设用户安装后会执行 TSX 编译。

### 8.5 AI 自查清单

在提交模板或迁移修复前，AI/开发者至少检查：

1. 是否先读取了官方最新文档或 Skill 缓存，而不是按旧 API 猜测。
2. 是否使用了 `.../index.tsx` 路由结构，并确认生成注册表包含新路由。
3. mock 是否放在正确位置，JSON 是否意外放到了模板目录根部。
4. 根节点是否错误写入 `id="container"`，以及圆角和 `overflow-hidden` 是否符合截图预期。
5. 是否使用语义主题类，是否残留会覆盖 HeroUI 的旧 `@theme` 映射。
6. 是否引入了第二份 React、手动导入 `.ktr` 或把 `node-karin` 带入云崽运行时。
7. 构建后是否真实导入 `lib/template-registry.js`，检查 CSS、字体、资源 URL 和 HTML 安全边界。
8. 模板是否自行对根元素设置 `zoom`/`transform: scale()` 或按 `ctx.scale` 乘尺寸；缩放必须只由 SSR 外层 `#container` 应用一次。
9. 是否运行 `pnpm template:sync`、`pnpm typecheck:template`、`pnpm build`、`pnpm test:dist`，并保留 legacy 回退路径。
