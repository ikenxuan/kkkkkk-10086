# JavaScript 到 TypeScript 迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 kkkkkk-10086 用户配置、数据库、插件命令、推送行为和安装方式的前提下，将 69 个 JavaScript 文件（约 16,940 行）分阶段迁移为可严格检查、可重复构建的 TypeScript 工程。

**Architecture:** 采用“运行拓扑一次切换，业务类型分批收紧”的渐进方案：源码统一进入 `src/`，TypeScript 编译为与源码同构的 `lib/` ESM 产物，根 `index.js` 与 `guoba.support.js` 仅桥接编译产物。迁移期通过 `allowJs: true` 支持 `.js`/`.ts` 共存，按运行时路径、配置、工具、数据库、平台、应用入口的依赖方向逐批迁移，最终关闭 JavaScript 输入与宽泛类型。

**Tech Stack:** Node.js 22、pnpm 9、TypeScript 5.9、NodeNext ESM、`@kaguyajs/trss-yunzai-types` 1.3.3（通过 `@types/trss-yunzai` alias）、ESLint 9、neostandard、Vitest、GitHub Actions。

## Global Constraints

- 支持 Miao-Yunzai 与 TRSS-Yunzai；迁移不得把 ICQQ 特有字段误认为所有适配器都具备。
- 保持 `package.json` 的 `type: "module"` 与根入口 `main: "index.js"`。
- 保持所有源码相对导入的 `.js` 后缀；TypeScript 在编译期解析 `.ts`，Node.js 在运行时加载 `.js`。
- 根 `index.js` 只允许桥接 `./lib/index.js`；根 `guoba.support.js` 只允许桥接 `./lib/guoba.support.js`。
- `resources/`、`config/`、`data/`、`CHANGELOG.md` 和 `package.json` 始终相对插件根目录解析，不能相对 `lib/` 解析。
- 不在 TypeScript 迁移中改变命令正则、插件优先级、定时任务、配置键、数据库 schema、API 路由或响应结构。
- 迁移期允许边界处使用 `unknown` 和窄化函数；禁止新增 `declare module '*'`、`// @ts-ignore` 和无说明的 `any`。
- `@types/trss-yunzai` 固定为 npm alias `npm:@kaguyajs/trss-yunzai-types@1.3.3`，不得继续使用 `latest`。
- 编译产物不压缩，保留可读堆栈；发布前必须由 CI 证明 `src/` 与提交的 `lib/` 一致。
- 每个阶段均须通过类型检查、单元测试、构建产物测试和至少一次 Yunzai 宿主烟测后再合并。

---

## 1. 背景与范围

### 1.1 当前工程基线

截至 2026-08-12，Git 跟踪的 JavaScript 迁移面如下：

| 区域 | 文件数 | 约行数 | 职责 |
| --- | ---: | ---: | --- |
| `apps/` | 7 | 1,422 | Yunzai `plugin` 子类、命令规则、定时推送 |
| `module/db/` | 4 | 2,349 | SQLite 初始化、缓存、订阅和统计 |
| `module/server/` | 2 | 188 | Express API、视频预览、SSE |
| `module/utils/` | 19 | 4,742 | 配置、路径、渲染、下载、FFmpeg、错误处理 |
| `module/platform/bilibili/` | 11 | 3,542 | B 站解析、登录、推送、风控 |
| `module/platform/douyin/` | 9 | 2,795 | 抖音解析、登录、推送 |
| `module/platform/kuaishou/` | 6 | 363 | 快手解析 |
| `module/platform/xiaohongshu/` | 5 | 487 | 小红书解析 |
| `module/platform/common/` | 2 | 439 | 弹幕和 Live Photo |
| 根工程文件 | 3 个业务 JS | 约 611 | 主入口、锅巴支持、ESLint 配置 |

核心运行契约：

1. `index.js` 导入配置，初始化三个数据库，创建临时目录。
2. 入口扫描 `apps/*.js`，并行导入后按文件名写入 `apps` 对象。
3. Yunzai 从根入口读取具名导出 `apps`。
4. `Config.app.APIServer` 开启时启动 Express 服务。
5. `guoba.support.js` 独立导出 `supportGuoba()`，不能因打开配置面板而触发主入口初始化。
6. 默认配置保存在 `config/default_config/*.yaml`，用户配置与数据库位于被 Git 忽略的 `config/config/`、`data/`。

### 1.2 已识别的迁移风险

| 风险 | 当前证据 | 迁移要求 |
| --- | --- | --- |
| 编译目录改变相对深度 | `module/utils/Version.js` 从自身向上两级计算插件根目录 | 新增唯一的运行时路径模块；源码和产物都必须得到同一个插件根目录 |
| 宿主深层相对导入失效 | `apps/update.js`、`Render.js`、`Base.js`、多个平台文件通过 `../../../` 访问 Yunzai `lib/` | 将宿主模块访问集中到 `src/runtime/host/`，基于 `process.cwd()` 与文件 URL 加载 |
| 动态 loader 只识别 `.js` | 当前入口读取 `apps` 并筛选 `.js` | loader 运行于 `lib/`，继续扫描编译后的 `.js`，不直接扫描 `.ts` |
| loader 取第一个导出 | 当前入口使用 `Object.keys(module)[0]` | 保持文件名作为 app 键，但要求每个 app 模块恰好导出一个插件构造器，错误时隔离并记录 |
| 类型配置名写错 | `jsconfig.json` 包含 `app/**/*`，实际目录为 `apps/` | 新 `tsconfig.json` 只包含 `src/**/*` |
| 声明文件被排除 | `jsconfig.json` 排除 `**/*.d.ts` | 新配置必须包含 `src/types/**/*.d.ts` |
| 类型依赖不可复现 | `@types/trss-yunzai` 使用 `latest`，锁文件被忽略 | 固定版本并提交 `pnpm-lock.yaml` |
| 生成物不随 Git 安装 | `.gitignore` 当前忽略 `lib/*` | 主分支提交 `lib/`，并由 CI 校验生成物无漂移 |
| TypeScript 类型包偏 ICQQ | TRSS-Yunzai-Types 文档明确多数协议类型基于 ICQQ | 对 Miao/TRSS 和多适配器字段使用本地窄接口与判别函数 |
| 配置与 API 数据结构动态 | YAML、第三方 API、锅巴提交数据大量使用 `any`/`Object` | 数据在边界以 `unknown` 进入，验证或归一化后转为领域类型 |
| 大小写跨平台差异 | 存在 `module/platform/kuaishou/API.js` | 开启大小写检查，并在 Windows 与 Linux CI 构建 |
| 数据库重复初始化语义 | `module/db/index.js` 既有顶层初始化，又由主入口调用 `initAllDatabases()` | 迁移阶段先用契约测试锁定；移除重复初始化必须单独提交，不夹带 schema 变化 |

### 1.3 不在本次范围

- 不重写平台解析算法。
- 不更换 SQLite、Express、Axios、Amagi 或渲染器。
- 不统一旧配置键与新配置键的名称；仅在类型层表达兼容关系。
- 不将插件迁移至 Karin。
- 不新增前端配置页面。
- 不在迁移提交中调整数据库表结构或清理历史数据。

## 2. 参考仓库结论

### 2.1 Yunzai-Plugin-Example-TS

参考地址：<https://github.com/KaguyaJs/Yunzai-Plugin-Example-TS>

可采用的实践：

- `src/` 为源码，`lib/` 为编译产物，根 `index.js` 使用 `export * from './lib/index.js'`。
- `package.json` 保持 ESM 与 `main: "index.js"`。
- 使用 `@types/trss-yunzai` alias 自动注入 `plugin`、`logger`、`Bot`、`segment`、`redis` 等全局类型。
- loader 运行时递归扫描编译后的 `.js`，通过 `pathToFileURL()` 动态导入，单文件失败不阻断全部插件。
- `src/dir.ts` 基于 `import.meta.url` 计算代码目录与插件目录。
- GitHub Actions 使用 Node 24、pnpm 9 构建，并依据 `package.json.files` 整理发布内容。

不能直接照搬的部分：

- 示例仓库没有数据库、Express 服务、Yunzai 宿主深层导入和大量资源路径。
- 示例 loader 用“导出名”作为 app 键；本仓库当前用“文件名”作为 app 键，迁移期应保持后者。
- 示例仓库没有测试，不能作为本项目验收标准。

### 2.2 Yunzai-DF-Plugin

参考地址：<https://github.com/KaguyaJs/Yunzai-DF-Plugin>

可采用的实践：

- `src -> lib`、strict TypeScript、根入口桥接的整体拓扑。
- `build`、`build:noMinify`、`build:watch` 分离；生产发布由 CI 构建。
- `guoba.support.js` 独立桥接 `lib/modules/guoba/index.js`，避免经过主入口。
- loader 收集缺失依赖后统一提示，其他导入异常逐文件记录。
- release 工作流在构建后按 `package.json.files` 发布独立分支。

本项目的取舍：

- 初次迁移不压缩 `lib/`，避免堆栈行号不可读。
- 初次迁移不引入路径别名；现有代码以相对导入为主，避免额外依赖 `tsc-alias` 和动态导入改写问题。
- 当前用户通过 Git 安装和更新，故主分支必须携带 `lib/`；独立 release 分支可在迁移稳定后另行评估。

### 2.3 TRSS-Yunzai-Types

参考地址：<https://github.com/KaguyaJs/TRSS-Yunzai-Types>

截至调研版本 1.3.3：

- `index.d.ts` 声明全局 `Bot`、`redis`、`segment`、`logger`，并导出 `plugin` 等类型。
- `plugin<T extends EventKeys = EventKeys>` 使用事件名泛型细化 `this.e`。
- `PluginOptions<T>` 描述 `event`、`rule`、`task`、`priority` 等插件配置。
- 消息事件是可辨识联合，可通过 `isGroup`、`isPrivate` 收窄。
- 声明主要基于 ICQQ；其他协议适配器字段可能不完整或不准确。
- 推荐安装形式为 `@types/trss-yunzai: npm:@kaguyajs/trss-yunzai-types@...`，让 TypeScript 自动发现全局声明。

使用原则：

- app 类写为 `extends plugin<'message'>`，方法事件参数写为 `e: typeof this.e`。
- 仅在类型包缺失真实运行字段时扩展本地声明。
- 适配器差异通过 `isMiaoEvent()`、`isTrssEvent()` 等运行时判别函数收窄，不通过强制断言绕过。
- `icqq.segment[]` 只用于确实限定为 ICQQ 的数据；跨适配器消息使用插件自己的消息元素联合类型。

## 3. 目标架构

### 3.1 目录结构

```text
kkkkkk-10086/
├─ index.js                         # 固定桥接 ./lib/index.js
├─ guoba.support.js                 # 固定桥接 ./lib/guoba.support.js
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ eslint.config.js
├─ src/
│  ├─ index.ts                      # 启动编排，不承载业务逻辑
│  ├─ guoba.support.ts              # 锅巴 schema 与配置读写
│  ├─ dir.ts                        # 所有插件内路径的唯一来源
│  ├─ apps/                         # 7 个 Yunzai plugin 子类
│  ├─ module/
│  │  ├─ loader/index.ts            # 编译产物 app loader
│  │  ├─ db/
│  │  ├─ server/
│  │  ├─ utils/
│  │  └─ platform/
│  ├─ runtime/host/
│  │  ├─ import-host.ts             # 安全构造宿主模块 file URL
│  │  ├─ common.ts                  # Yunzai common 窄接口
│  │  ├─ config.ts                  # Yunzai cfg 窄接口
│  │  ├─ puppeteer.ts               # Yunzai puppeteer 窄接口
│  │  └─ update.ts                  # other/update 窄接口与延迟加载
│  └─ types/
│     ├─ config.ts                  # 插件 YAML 配置模型
│     ├─ platform.ts                # 平台名、解析结果、质量等共享类型
│     ├─ database.ts                # SQLite 行与查询结果类型
│     ├─ message.ts                 # 跨适配器消息元素和事件扩展
│     └─ global.d.ts                # 仅声明真实存在的项目全局变量
├─ lib/                             # tsc 生成，与 src 同构，提交到 Git
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ contracts/
│  └─ fixtures/
├─ config/default_config/
├─ resources/
└─ data/                            # 运行时创建，不入 Git
```

### 3.2 编译模型

初始 `tsconfig.json`：

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./src",
    "outDir": "./lib",
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": false,
    "noEmitOnError": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "types": ["node", "trss-yunzai"]
  },
  "include": ["src/**/*"],
  "exclude": ["lib", "node_modules", "tests"]
}
```

最终状态只改变两项：

```jsonc
{
  "compilerOptions": {
    "allowJs": false,
    "checkJs": false
  }
}
```

选择 `NodeNext` 而不是参考项目的 `ESNext + bundler`，原因是本项目没有 bundler，真实运行时就是 Node.js ESM。`NodeNext` 能在编译阶段发现扩展名、包导出和 ESM/CJS 互操作问题。

### 3.3 入口与 loader

根入口保持极小且稳定：

```js
// index.js
export * from './lib/index.js'
```

```js
// guoba.support.js
export * from './lib/guoba.support.js'
```

`src/index.ts` 的职责顺序固定为：

1. 初始化配置与运行时路径。
2. 初始化数据库并等待完成。
3. 创建图片和视频临时目录并等待完成。
4. 从编译目录加载 apps。
5. 导出 `apps`。
6. 按配置延迟导入并启动 API 服务。

loader 契约：

```ts
export type AppModule = Record<string, unknown>
export type PluginConstructor = typeof plugin

export interface LoadAppsResult {
  apps: Record<string, PluginConstructor>
  loadedFiles: string[]
  failedFiles: Array<{ file: string; error: unknown }>
}

export async function loadAppsFrom(appsDir: string): Promise<LoadAppsResult>
export async function loadApps(): Promise<LoadAppsResult>
```

行为约束：

- 只扫描 `lib/apps/*.js`，按文件名排序保证日志稳定。
- 使用 `pathToFileURL(absolutePath).href` 动态导入，兼容 Windows。
- app 键保持为文件 basename，例如 `admin.js -> apps.admin`。
- 每个 app 文件必须恰好导出一个具有 `prototype` 的函数/类；零个或多个均记为加载失败。
- 单个 app 失败不阻断其他 app，与当前 `Promise.allSettled` 容错语义一致。

### 3.4 路径模型

`src/dir.ts` 是插件内部路径的唯一事实来源：

```ts
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CodePath = dirname(fileURLToPath(import.meta.url))
export const PluginPath = dirname(CodePath)
export const AppsPath = join(CodePath, 'apps')
export const ResourcePath = join(PluginPath, 'resources')
export const DefaultConfigPath = join(PluginPath, 'config', 'default_config')
export const UserConfigPath = join(PluginPath, 'config', 'config')
export const DataPath = join(PluginPath, 'data')
export const ClientPath = process.cwd()
```

该算法在源码测试时从 `src/dir.ts` 向上一层得到插件根目录，在生产运行时从 `lib/dir.js` 向上一层也得到同一个插件根目录。

所有原先通过当前文件层级访问 Yunzai 根目录的导入必须改为宿主 adapter。adapter 使用：

```ts
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ClientPath } from '../../dir.js'

export async function importHost<T>(...segments: string[]): Promise<T> {
  const url = pathToFileURL(join(ClientPath, ...segments)).href
  return await import(url) as T
}
```

业务模块不得再次出现四层以上的 `../` 宿主导入。

### 3.5 类型边界

#### 配置

以文件名为顶层键定义 `PluginConfigMap`：

```ts
export interface PluginConfigMap {
  app: AppConfig
  bilibili: BilibiliConfig
  cookies: CookiesConfig
  douyin: DouyinConfig
  kuaishou: KuaishouConfig
  pushlist: PushlistConfig
  request: RequestConfig
  upload: UploadConfig
  xiaohongshu: XiaohongshuConfig
}

export type ConfigName = keyof PluginConfigMap
```

`Config.getDefOrConfig<K extends ConfigName>(name: K)` 返回 `PluginConfigMap[K]`。旧键与新键同时保留在接口中，例如 `videotool`/`videoTool`、`douyintool`/`switch`；业务侧继续通过现有归一化函数读取，迁移不改变配置文件。

#### Yunzai 事件

- app 类均指定 `plugin<'message'>`。
- 规则方法使用 `e: typeof this.e`，不再使用 `Object` 或裸 `any`。
- 主动推送、无触发事件的业务类使用项目自有 `MessageContext | undefined`，不能伪造完整消息事件。
- `e.bot.adapter` 等跨框架字段用判别函数访问。

#### 第三方 API

- Amagi 已提供泛型响应时直接使用包导出的类型。
- 兼容 wrapper 的外部数据先返回 `unknown`，由每个平台的解析函数窄化。
- 不为完整第三方响应手写巨型接口，只描述本插件实际读取的字段。
- 错误统一为 `unknown`，通过 `error instanceof Error` 或 `getErrorMessage()` 处理。

#### SQLite

```ts
export interface RunResult {
  lastID: number
  changes: number
}

export type Platform = 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'

export interface ParseStatisticsRow {
  id: number
  groupId: string
  userId: string
  platform: Platform
  parseCount: number
  createdAt: string
  updatedAt: string
}
```

查询 helper 使用泛型：`getQuery<T>() => Promise<T | undefined>`、`allQuery<T>() => Promise<T[]>`，避免数据库结果在业务层继续扩散为 `any`。

### 3.6 构建、安装与发布

推荐脚本：

```json
{
  "scripts": {
    "build": "rimraf lib && tsc -p tsconfig.json",
    "build:watch": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint src tests index.js guoba.support.js",
    "fix": "eslint src tests index.js guoba.support.js --fix",
    "test": "vitest run",
    "test:dist": "node --test tests/contracts/*.test.mjs",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:dist"
  }
}
```

发布策略选择“主分支携带 `lib/`”：

- 当前 Yunzai 插件安装/更新是 Git 工作流，不能假设用户机器会执行 `pnpm build`。
- `.gitignore` 删除 `lib/*` 忽略规则，提交编译产物。
- CI 重新构建后执行 `git diff --exit-code -- lib`；有差异则拒绝合并。
- `package.json.files` 明确包含根桥接、`lib/`、`resources/`、默认配置、README、CHANGELOG 和 LICENSE。
- `config/config/`、`data/` 不进入发布包和 Git。

## 4. 测试与验收

### 4.1 测试层级

1. 单元测试：路径、配置归一化、ID 提取、平台选择、下载参数、错误归一化。
2. 集成测试：临时目录中的 YAML 读写、SQLite 初始化与 CRUD、Express health/range/SSE。
3. 产物契约测试：根桥接、`lib` 文件结构、动态 loader、资源路径、无 `.ts` import 与无未改写 alias。
4. 宿主烟测：在 Miao-Yunzai 与 TRSS-Yunzai 各启动一次，验证 7 个 app、命令、锅巴和可选 API 服务。

### 4.2 每阶段自动验收

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:dist
git diff --exit-code -- lib
```

预期全部退出码为 0。

### 4.3 最终人工验收矩阵

| 场景 | Miao-Yunzai | TRSS-Yunzai | 预期 |
| --- | --- | --- | --- |
| 冷启动 | 必测 | 必测 | 7 个 app 全部加载，无未处理异常 |
| 旧配置启动 | 必测 | 必测 | 不改写或丢失用户配置 |
| 数据库路径 | 必测 | 必测 | 仍为插件根 `data/*.db`，历史数据可读 |
| `#kkk帮助` | 必测 | 必测 | 模板、字体、图片正常 |
| 四平台链接 | 必测 | 必测 | 规则触发和发送行为与迁移前一致 |
| B 站/抖音推送 | 必测 | 必测 | 完整运行一个 cron 周期，无重复推送 |
| 锅巴读取和保存 | 必测 | 必测 | schema 完整，保存后 YAML/DB 同步正常 |
| API 关闭 | 必测 | 必测 | 不监听端口 |
| API 开启 | 必测 | 必测 | `/kkk/health`、预览、Range 和 SSE 正常 |
| 更新命令 | 必测 | 必测 | 宿主 update 模块成功延迟加载 |
| Windows/Linux | CI | CI | 大小写和 file URL 均通过 |

### 4.4 完成定义

- `src/` 中不存在业务 `.js` 文件。
- `tsconfig.json` 为 `allowJs: false`，严格类型检查零错误。
- 不存在 `@param {Object}`、`Record<string, any>`、裸 `any`、`@ts-ignore` 和 `declare module '*'`。
- 7 个 app 的文件名、规则、优先级和 task 数量与基线一致。
- 旧 YAML 与 SQLite 无迁移即可继续使用。
- 根入口与锅巴入口只包含各自一条桥接导出。
- 干净克隆无需本地 TypeScript 工具即可由 Yunzai 加载提交的 `lib/`。
- CI 在 Windows 与 Linux 上通过，并证明构建后 `lib/` 无差异。

## 5. 回滚方案

- 首个 TypeScript 版本发布前标记最后一个纯 JS tag，并备份 `config/config/` 与 `data/*.db`。
- 每阶段不得修改数据库 schema，因此代码回滚不需要数据回滚。
- 发布先在单实例运行至少一个完整推送周期，再推广到其他实例。
- 出现 app 缺失、数据库路径改变、配置写坏、资源找不到或重复推送时，立即回退到上一包含完整 `lib/` 的 tag。
- 禁止通过删除 `data/`、重建数据库或覆盖用户 YAML 解决迁移回滚。

---

## 6. 分阶段实施任务

### Task 1: 冻结 JavaScript 行为基线

**Files:**
- Create: `tests/fixtures/baseline/apps.json`
- Create: `tests/contracts/source-baseline.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: 当前根 `index.js`、`apps/*.js` 和默认 YAML。
- Produces: 固定 app 文件名、类名、事件、规则数和默认配置文件名的基线清单。

- [ ] **Step 1: 记录 app 基线**

创建 `tests/fixtures/baseline/apps.json`：

```json
{
  "admin": "kkkAdmin",
  "help": "kkkHelp",
  "push": "kkkPush",
  "statistics": "kkkStatistics",
  "testPush": "kkkTestPush",
  "tools": "kkkTools",
  "update": "kkkUpdate"
}
```

- [ ] **Step 2: 添加源码契约测试**

`tests/contracts/source-baseline.test.mjs` 读取 `apps/`，断言文件集合与基线一致，并用静态文本断言每个文件仍包含 `event: 'message'` 和对应类导出；同时断言默认配置文件集合为：

```js
const configFiles = [
  'app.yaml',
  'bilibili.yaml',
  'cookies.yaml',
  'douyin.yaml',
  'kuaishou.yaml',
  'pushlist.yaml',
  'request.yaml',
  'upload.yaml',
  'xiaohongshu.yaml'
]
```

- [ ] **Step 3: 运行基线测试**

Run: `node --test tests/contracts/source-baseline.test.mjs`

Expected: 7 个 app 与 9 个默认配置文件断言全部 PASS。

- [ ] **Step 4: 提交基线**

```bash
git add package.json tests
git commit -m "test: freeze javascript migration baseline"
```

### Task 2: 建立可重复的 TypeScript 工具链

**Files:**
- Create: `tsconfig.json`
- Modify: `package.json`
- Modify: `eslint.config.js`
- Modify: `.gitignore`
- Delete after replacement: `jsconfig.json`
- Create: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Node.js ESM 与现有 pnpm 依赖。
- Produces: `build`、`typecheck`、`lint`、`test`、`test:dist`、`check` 脚本；迁移期 `.js`/`.ts` 混合编译能力。

- [ ] **Step 1: 固定运行与开发依赖**

将 `package.json` 中类型依赖改为精确 alias，并加入：

```json
{
  "engines": { "node": ">=22.12.0" },
  "packageManager": "pnpm@9.15.9",
  "devDependencies": {
    "@types/cors": "2.8.19",
    "@types/express": "5.0.3",
    "@types/heic-convert": "1.2.3",
    "@types/lodash": "4.17.20",
    "@types/node": "22.18.6",
    "@types/qrcode": "1.5.5",
    "@types/trss-yunzai": "npm:@kaguyajs/trss-yunzai-types@1.3.3",
    "rimraf": "6.0.1",
    "typescript": "5.9.3",
    "typescript-eslint": "8.44.1",
    "vitest": "3.2.4"
  }
}
```

保留现有运行依赖；添加本设计第 3.6 节的 scripts。

- [ ] **Step 2: 写入迁移期 tsconfig**

使用本设计第 3.2 节完整配置，确保 `include` 是 `src/**/*`，且不排除 `.d.ts`。

- [ ] **Step 3: 更新 ESLint**

使用 `neostandard({ ts: true })`，声明 `Bot`、`redis`、`plugin`、`segment`、`logger` 为只读全局，忽略 `lib/`、`node_modules/`、`data/`、`config/config/`。

- [ ] **Step 4: 固定 lockfile 与生成物策略**

从 `.gitignore` 删除 `pnpm-lock.yaml` 与 `lib/*`，保留 `data/*` 和 `config/config/*`。执行：

```bash
pnpm install
```

Expected: 生成 `pnpm-lock.yaml`，安装过程退出码为 0。

- [ ] **Step 5: 提交工具链**

```bash
git add package.json pnpm-lock.yaml tsconfig.json eslint.config.js .gitignore
git rm jsconfig.json
git commit -m "build: add staged typescript toolchain"
```

### Task 3: 切换 src/lib 运行拓扑与路径边界

**Files:**
- Move: `apps/` -> `src/apps/`
- Move: `module/` -> `src/module/`
- Move: `index.js` -> `src/index.js`
- Move: `guoba.support.js` -> `src/guoba.support.js`
- Create: `index.js`
- Create: `guoba.support.js`
- Create: `src/dir.ts`
- Create: `src/runtime/host/import-host.ts`
- Create: `src/runtime/host/common.ts`
- Create: `src/runtime/host/config.ts`
- Create: `src/runtime/host/puppeteer.ts`
- Create: `src/runtime/host/update.ts`
- Modify: `src/module/utils/Version.js`
- Modify: `src/module/utils/Render.js`
- Modify: `src/module/utils/Base.js`
- Modify: `src/module/utils/ErrorHandler/sender.js`
- Modify: `src/module/platform/{bilibili,douyin,xiaohongshu}/*.js` 中的宿主 common 导入
- Modify: `src/apps/update.js`
- Test: `tests/unit/dir.test.ts`
- Test: `tests/contracts/entry-bridge.test.mjs`

**Interfaces:**
- Consumes: `ClientPath = process.cwd()` 和 Node.js file URL 动态导入。
- Produces: `PluginPath`、`AppsPath`、`ResourcePath`、`DefaultConfigPath`、`UserConfigPath`、`DataPath`、`ClientPath`；根入口桥接。

- [ ] **Step 1: 先写路径测试**

`tests/unit/dir.test.ts` 断言 `PluginPath` 等于仓库根目录，资源和默认配置存在，`DataPath` 的 parent 是插件根目录。

- [ ] **Step 2: 写根桥接契约测试**

`tests/contracts/entry-bridge.test.mjs` 断言：

```js
assert.equal(await readFile('index.js', 'utf8'), "export * from './lib/index.js'\n")
assert.equal(await readFile('guoba.support.js', 'utf8'), "export * from './lib/guoba.support.js'\n")
```

- [ ] **Step 3: 移动源码并创建桥接**

```bash
git mv apps src/apps
git mv module src/module
git mv index.js src/index.js
git mv guoba.support.js src/guoba.support.js
```

根文件写入第 3.3 节两条桥接导出。

- [ ] **Step 4: 实现唯一的路径模块和宿主 adapter**

按第 3.4 节实现 `src/dir.ts` 与 `importHost<T>()`。四个宿主 adapter 只暴露当前代码实际使用的方法，不导出整个模块为 `any`。

- [ ] **Step 5: 替换层级敏感导入**

替换以下宿主依赖：

```text
src/apps/update.js
src/module/utils/Render.js
src/module/utils/Base.js
src/module/utils/ErrorHandler/sender.js
src/module/platform/xiaohongshu/xiaohongshu.js
src/module/platform/douyin/push.js
src/module/platform/douyin/douyin.js
src/module/platform/bilibili/bilibili.js
src/module/platform/bilibili/push.js
```

`Version.js` 改为从 `src/dir.ts` 的编译模块获取 `PluginPath` 与 `ClientPath`，不再根据自身嵌套层级向上计算。

- [ ] **Step 6: 构建并验证路径**

```bash
pnpm test
pnpm build
node --test tests/contracts/entry-bridge.test.mjs
```

Expected: `lib/apps/`、`lib/module/`、`lib/index.js`、`lib/guoba.support.js` 存在；资源、配置和数据库路径不含 `/lib/resources`、`/lib/config` 或 `/lib/data`。

- [ ] **Step 7: 提交运行拓扑**

```bash
git add index.js guoba.support.js src lib tests package.json tsconfig.json
git commit -m "refactor: compile plugin sources into lib"
```

### Task 4: 提取并迁移 app loader

**Files:**
- Create: `src/module/loader/index.ts`
- Modify: `src/index.js`
- Test: `tests/unit/loader.test.ts`
- Test: `tests/fixtures/apps/valid.js`
- Test: `tests/fixtures/apps/invalid.js`

**Interfaces:**
- Consumes: `AppsPath` 与编译后的 app ESM 文件。
- Produces: `loadAppsFrom(appsDir): Promise<LoadAppsResult>` 和 `loadApps()`。

- [ ] **Step 1: 写 loader 失败测试**

覆盖三个断言：文件按名称排序；有效模块以 basename 注册；无插件构造器的模块进入 `failedFiles` 而不抛出整个加载过程。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/unit/loader.test.ts`

Expected: FAIL，提示 `loadAppsFrom` 尚未导出。

- [ ] **Step 3: 实现 loader**

使用 `readdir(..., { withFileTypes: true })`、`pathToFileURL()`、`Promise.allSettled()` 和本设计第 3.3 节接口。保持 app 键为文件 basename。

- [ ] **Step 4: 将入口改为调用 loader**

删除 `src/index.js` 中直接 `readdirSync()` 和 `Object.keys(module)[0]` 的代码，改为：

```js
const { apps, failedFiles } = await loadApps()
for (const { file, error } of failedFiles) logger.error(`载入插件错误：${file}`, error)
export { apps }
```

- [ ] **Step 5: 验证 7 个 app**

Run: `pnpm test && pnpm build && pnpm test:dist`

Expected: 产物 loader 返回 `admin`、`help`、`push`、`statistics`、`testPush`、`tools`、`update`。

- [ ] **Step 6: 提交 loader**

```bash
git add src/module/loader src/index.js tests lib
git commit -m "refactor: add typed application loader"
```

### Task 5: 迁移配置模型与配置服务

**Files:**
- Create: `src/types/config.ts`
- Rename: `src/module/utils/Config.js` -> `src/module/utils/Config.ts`
- Rename: `src/module/utils/YamlReader.js` -> `src/module/utils/YamlReader.ts`
- Test: `tests/unit/config.test.ts`
- Test: `tests/integration/config-files.test.ts`

**Interfaces:**
- Consumes: 9 个 `config/default_config/*.yaml` 和用户覆盖配置。
- Produces: `PluginConfigMap`、`ConfigName`、所有平台配置接口、类型化 `Config` getter/modify API。

- [ ] **Step 1: 为默认 YAML 写结构测试**

解析每个默认 YAML，断言结果是非数组对象；断言 `request.timeout`、`app.priority`、`upload.downloadConcurrency` 的运行类型为 number，平台开关为 boolean。

- [ ] **Step 2: 定义配置接口**

将 `Config.js` 顶部现有 JSDoc typedef 迁入 `src/types/config.ts`。保留所有旧键与新键，推送列表使用 `DouyinPushItem[]`、`BilibiliPushItem[]`，`ConfigName` 不包含计算属性 `amagi`。

- [ ] **Step 3: 类型化 YAML reader**

`YamlReader.get<T = unknown>(key: string): T | undefined`；`set(key: string, value: unknown): void`。YAML.parse 返回值先验证为 record，失败时保持现有空对象与日志行为。

- [ ] **Step 4: 类型化 Config**

实现：

```ts
getDefOrConfig<K extends ConfigName>(name: K): PluginConfigMap[K]
getdefSet<K extends ConfigName>(name: K): PluginConfigMap[K]
getConfig<K extends ConfigName>(name: K): Partial<PluginConfigMap[K]>
modify<K extends ConfigName>(name: K, key: string, value: unknown, type?: ConfigSource): void
```

配置 cache 使用 `Record<string, unknown>`，读取时集中窄化，不把索引签名 `any` 扩散到调用方。

- [ ] **Step 5: 验证配置兼容性**

Run: `pnpm vitest run tests/unit/config.test.ts tests/integration/config-files.test.ts`

Expected: 默认值、用户覆盖、嵌套修改、锅巴批量写入和旧/新键读取全部 PASS；fixture 写入临时目录，不触碰真实 `config/config/`。

- [ ] **Step 6: 提交配置迁移**

```bash
git add src/types/config.ts src/module/utils/Config.ts src/module/utils/YamlReader.ts tests lib
git commit -m "refactor: type plugin configuration"
```

### Task 6: 迁移基础工具与错误边界

**Files:**
- Rename to `.ts`: `src/module/utils/Common.js`
- Rename to `.ts`: `src/module/utils/Version.js`
- Rename to `.ts`: `src/module/utils/Networks.js`
- Rename to `.ts`: `src/module/utils/ImageHelper.js`
- Rename to `.ts`: `src/module/utils/EmojiReaction.js`
- Rename to `.ts`: `src/module/utils/UploadRecord.js`
- Rename to `.ts`: `src/module/utils/MultipartDownloader.js`
- Rename to `.ts`: `src/module/utils/ErrorHandler/*.js`
- Rename to `.ts`: `src/module/utils/index.js`
- Create: `src/types/message.ts`
- Create: `src/types/platform.ts`
- Test: `tests/unit/error-handler.test.ts`
- Test: `tests/unit/download-options.test.ts`

**Interfaces:**
- Consumes: Node 文件/网络 API、Config、宿主消息发送接口。
- Produces: 类型化网络 header、下载结果、消息上下文、错误归一化 helper。

- [ ] **Step 1: 写错误与下载边界测试**

覆盖 `unknown` Error、字符串错误、Axios 风格错误；覆盖单线程、多线程、限速配置归一化与 2-8 并发边界。

- [ ] **Step 2: 建立共享领域类型**

在 `platform.ts` 定义 `Platform`、视频质量、文件信息、下载选项；在 `message.ts` 定义本插件实际使用的消息字段与跨适配器消息元素。

- [ ] **Step 3: 按依赖顺序改名并消除 any**

顺序为 `Version -> Common -> Networks -> ImageHelper/EmojiReaction -> UploadRecord/MultipartDownloader -> ErrorHandler -> barrel index`。catch 参数保持 `unknown`，通过统一 helper 获取消息。

- [ ] **Step 4: 验证工具层**

Run: `pnpm typecheck && pnpm vitest run tests/unit/error-handler.test.ts tests/unit/download-options.test.ts && pnpm build`

Expected: 无类型错误，现有下载方法的函数名与返回结构不变。

- [ ] **Step 5: 提交工具层**

```bash
git add src/module/utils src/types tests lib
git commit -m "refactor: migrate core utilities to typescript"
```

### Task 7: 迁移媒体、渲染与服务端

**Files:**
- Rename to `.ts`: `src/module/utils/Base.js`
- Rename to `.ts`: `src/module/utils/FFmpeg.js`
- Rename to `.ts`: `src/module/utils/Render.js`
- Rename to `.ts`: `src/module/utils/Watermark.js`
- Rename to `.ts`: `src/module/server/index.js`
- Rename to `.ts`: `src/module/server/response.js`
- Test: `tests/unit/ffmpeg-options.test.ts`
- Test: `tests/integration/server.test.ts`

**Interfaces:**
- Consumes: Config、宿主 puppeteer、Express、资源模板、平台消息上下文。
- Produces: 类型化 `Base`、媒体 helper、`startPluginServer()` 与 Express app factory。

- [ ] **Step 1: 先暴露可测试的 server factory**

导出 `createPluginServer()`，但保持 `startPluginServer()` 的单例监听行为与现有路由不变。

- [ ] **Step 2: 写 API 集成测试**

使用临时视频文件验证 `/kkk/health`、完整文件响应、合法 Range 206、非法 Range 416、非法文件名 404；测试结束显式关闭 server。

- [ ] **Step 3: 类型化媒体选项**

将 Base/FFmpeg 顶部 JSDoc options 迁移为 interface；代理 handler 的 `prop` 使用 `keyof`，参数使用 tuple/unknown，不改变 Amagi 调用顺序。

- [ ] **Step 4: 验证服务端与渲染路径**

Run: `pnpm vitest run tests/unit/ffmpeg-options.test.ts tests/integration/server.test.ts && pnpm build`

Expected: 测试通过，模板路径指向插件根 `resources/template`。

- [ ] **Step 5: 提交媒体与服务端**

```bash
git add src/module/utils src/module/server tests lib
git commit -m "refactor: type media and api services"
```

### Task 8: 迁移数据库层

**Files:**
- Create: `src/types/database.ts`
- Rename to `.ts`: `src/module/db/index.js`
- Rename to `.ts`: `src/module/db/statistics.js`
- Rename to `.ts`: `src/module/db/douyin.js`
- Rename to `.ts`: `src/module/db/bilibili.js`
- Test: `tests/integration/statistics-db.test.ts`
- Test: `tests/integration/push-db.test.ts`

**Interfaces:**
- Consumes: SQLite 与插件根 `DataPath`。
- Produces: 类型化 DB 单例 getter、行类型、`RunResult`、原有兼容导出 `douyinDB`/`bilibiliDB`/`statisticsDB`。

- [ ] **Step 1: 写临时数据库测试**

通过依赖注入的数据目录创建临时 DB，验证建表、插入、更新、查询、清理与重复初始化；断言真实仓库 `data/` 未被测试修改。

- [ ] **Step 2: 定义查询结果类型**

实现 `RunResult`、统计行、抖音用户/缓存行、B 站用户/缓存行，并将 query helper 改为泛型返回值。

- [ ] **Step 3: 迁移单例初始化**

保持 `getDouyinDB()`、`getBilibiliDB()`、`getStatisticsDB()`、`initAllDatabases()` 和兼容实例导出名称。将“并发初始化等待 100ms”替换为共享初始化 Promise 时，必须由重复初始化测试证明只创建一个连接。

- [ ] **Step 4: 验证旧 schema**

复制脱敏后的旧数据库 fixture，运行只读查询和新增记录；不得执行破坏性 migration。

- [ ] **Step 5: 提交数据库层**

```bash
git add src/module/db src/types/database.ts tests lib
git commit -m "refactor: migrate database layer to typescript"
```

### Task 9: 迁移平台公共层与小平台

**Files:**
- Rename to `.ts`: `src/module/platform/common/*.js`
- Rename to `.ts`: `src/module/platform/kuaishou/*.js`
- Rename to `.ts`: `src/module/platform/xiaohongshu/*.js`
- Test: `tests/unit/kuaishou-id.test.ts`
- Test: `tests/unit/xiaohongshu-id.test.ts`
- Test: `tests/unit/live-photo.test.ts`

**Interfaces:**
- Consumes: Base、Config、网络与媒体 helper。
- Produces: 快手/小红书 ID 判别联合、平台处理类、弹幕和 Live Photo 类型化 API。

- [ ] **Step 1: 为 ID 提取和 Live Photo 写表驱动测试**

fixture 覆盖长链接、短链接、非法链接、缺失字段和不同 Live Photo 系统模式。

- [ ] **Step 2: 先迁移 common，再迁移 kuaishou/xiaohongshu**

将返回对象改为带 `type` 字段的判别联合。统一文件名 `API.js` 的大小写；所有 import 与实际文件名完全一致。

- [ ] **Step 3: 验证平台公共层**

Run: `pnpm typecheck && pnpm vitest run tests/unit/kuaishou-id.test.ts tests/unit/xiaohongshu-id.test.ts tests/unit/live-photo.test.ts && pnpm build`

Expected: Windows 与 Linux 均无大小写解析错误。

- [ ] **Step 4: 提交小平台**

```bash
git add src/module/platform/common src/module/platform/kuaishou src/module/platform/xiaohongshu tests lib
git commit -m "refactor: type common and small platform modules"
```

### Task 10: 迁移抖音平台

**Files:**
- Rename to `.ts`: `src/module/platform/douyin/*.js`
- Test: `tests/unit/douyin-api.test.ts`
- Test: `tests/unit/douyin-id.test.ts`
- Test: `tests/unit/douyin-push-filter.test.ts`

**Interfaces:**
- Consumes: Amagi `douyinFetcher`、Config、DB、Base、Render。
- Produces: 类型化 Douyin ID 判别联合、兼容 API wrapper、推送数据与过滤逻辑。

- [ ] **Step 1: 测试 v5 兼容 wrapper**

覆盖 `(method, cookie, options)` 与 `(method, options)` 两种调用形态，以及未知中文方法抛出 `Unsupported Douyin API method`。

- [ ] **Step 2: 类型化 API method 映射**

使用 `keyof typeof DouyinMethodToFetcher` 和 fetcher 方法参数类型；外部响应在 wrapper 边界收窄，不将 `Promise<any>` 保留到业务层。

- [ ] **Step 3: 迁移解析、登录、评论和推送**

按 `api/getid -> comments/login -> douyin -> push/pushPreview -> index` 顺序。推送消息元素使用跨适配器类型，ICQQ 专用段落单独收窄。

- [ ] **Step 4: 验证抖音平台**

Run: `pnpm typecheck && pnpm vitest run tests/unit/douyin-*.test.ts && pnpm build`

Expected: wrapper、ID、过滤和构建全部 PASS。

- [ ] **Step 5: 提交抖音平台**

```bash
git add src/module/platform/douyin tests lib
git commit -m "refactor: migrate douyin platform to typescript"
```

### Task 11: 迁移 Bilibili 平台

**Files:**
- Rename to `.ts`: `src/module/platform/bilibili/*.js`
- Test: `tests/unit/bilibili-api.test.ts`
- Test: `tests/unit/bilibili-id.test.ts`
- Test: `tests/unit/bilibili-quality.test.ts`
- Test: `tests/unit/bilibili-push-filter.test.ts`

**Interfaces:**
- Consumes: Amagi Bilibili API、Config、DB、Base、Render。
- Produces: Bilibili ID 判别联合、风控错误类型、画质选择和推送类型。

- [ ] **Step 1: 为 API、ID、画质和过滤写失败测试**

覆盖 BV/av/短链/动态/番剧、DASH 画质去重、自动体积策略、风控 `-352` voucher 与推送黑白名单。

- [ ] **Step 2: 迁移低依赖文件**

顺序为 `api/getid/genParams/dynamicText/article/comments/riskControl/login`，每次改名保持 `.js` import specifier。

- [ ] **Step 3: 迁移核心解析与推送**

迁移 `bilibili.js`、`push.js`、`index.js`。将重复的画质对象定义为局部 interface，不为完整上游 JSON 建模。

- [ ] **Step 4: 验证 Bilibili 平台**

Run: `pnpm typecheck && pnpm vitest run tests/unit/bilibili-*.test.ts && pnpm build`

Expected: 所有测试与构建 PASS，风控错误保留 `code/platform/data/rawError` 字段。

- [ ] **Step 5: 提交 Bilibili 平台**

```bash
git add src/module/platform/bilibili tests lib
git commit -m "refactor: migrate bilibili platform to typescript"
```

### Task 12: 迁移 7 个 Yunzai app

**Files:**
- Rename to `.ts`: `src/apps/admin.js`
- Rename to `.ts`: `src/apps/help.js`
- Rename to `.ts`: `src/apps/push.js`
- Rename to `.ts`: `src/apps/statistics.js`
- Rename to `.ts`: `src/apps/testPush.js`
- Rename to `.ts`: `src/apps/tools.js`
- Rename to `.ts`: `src/apps/update.js`
- Test: `tests/contracts/apps.test.ts`

**Interfaces:**
- Consumes: 全部已迁移的 module API 与全局 `plugin<'message'>`。
- Produces: 与基线相同的 7 个插件类、规则和定时任务。

- [ ] **Step 1: 写 app 契约测试**

在导入 app 前设置最小 `globalThis.plugin` 测试替身，实例化 7 个类，断言名称、event、priority、rule 的 `reg/fnc/permission` 和 task 数量与迁移前 fixture 一致。

- [ ] **Step 2: 迁移简单 app**

顺序为 `update -> help -> statistics -> testPush`。类声明使用：

```ts
export class kkkHelp extends plugin<'message'> {
  async help(e: typeof this.e): Promise<boolean> {
    // 保持原实现
  }
}
```

- [ ] **Step 3: 迁移复杂 app**

迁移 `admin -> push -> tools`。动态 handler 名定义为字面量联合，`this[config.handler]` 通过类型化 dispatch map 调用，不用字符串索引 `any`。

- [ ] **Step 4: 验证 app 契约**

Run: `pnpm vitest run tests/contracts/apps.test.ts && pnpm build && pnpm test:dist`

Expected: 7 个 app、规则、权限、优先级和 task 与基线一致。

- [ ] **Step 5: 提交 apps**

```bash
git add src/apps tests lib
git commit -m "refactor: migrate yunzai applications to typescript"
```

### Task 13: 迁移入口与锅巴支持

**Files:**
- Rename: `src/index.js` -> `src/index.ts`
- Rename: `src/guoba.support.js` -> `src/guoba.support.ts`
- Create: `src/types/guoba.ts`
- Test: `tests/contracts/bootstrap.test.ts`
- Test: `tests/contracts/guoba.test.ts`

**Interfaces:**
- Consumes: loader、DB、Config、Common、server。
- Produces: 根入口 `apps` 导出和独立 `supportGuoba()`。

- [ ] **Step 1: 写 bootstrap 顺序测试**

通过依赖注入的初始化函数记录调用顺序，断言 `database -> directories -> apps -> optional server`。server 关闭时不得导入 server 模块。

- [ ] **Step 2: 写锅巴隔离测试**

导入 `lib/guoba.support.js`，断言返回 `pluginInfo/configInfo`，并断言数据库初始化和 server 启动替身均未调用。

- [ ] **Step 3: 迁移主入口**

使用显式 `await` 保证数据库和目录在 apps 前就绪；保留单 app 加载失败的日志和启动 banner。

- [ ] **Step 4: 类型化锅巴 schema**

在 `src/types/guoba.ts` 定义本项目使用的 component discriminated union；`setConfigData(data: unknown, context)` 先验证 record，再执行现有批量/点路径写入逻辑。

- [ ] **Step 5: 验证入口隔离**

Run: `pnpm test && pnpm build && pnpm test:dist`

Expected: 主入口加载 7 个 app；锅巴入口不初始化 DB、不加载 apps、不启动 server。

- [ ] **Step 6: 提交入口**

```bash
git add src/index.ts src/guoba.support.ts src/types/guoba.ts tests lib index.js guoba.support.js
git commit -m "refactor: type plugin and guoba entrypoints"
```

### Task 14: 关闭 JavaScript 兼容并收紧类型

**Files:**
- Modify: `tsconfig.json`
- Modify: all remaining `src/**/*.ts` containing broad suppressions
- Delete: remaining `src/**/*.js`
- Test: all tests

**Interfaces:**
- Consumes: 全部 TypeScript 源码。
- Produces: `allowJs: false` 的严格工程。

- [ ] **Step 1: 扫描剩余 JavaScript 与宽泛类型**

Run:

```bash
git ls-files 'src/**/*.js'
rg -n "@ts-ignore|declare module ['\"]\*|Record<string, any>|:\s*any\b|<any>" src
```

Expected: 第一条无输出；第二条只允许经过审查的第三方边界，且每处有具体原因注释。

- [ ] **Step 2: 关闭 allowJs**

将 `allowJs` 改为 `false`，保留 `strict`、`noUncheckedIndexedAccess`、`noEmitOnError`。

- [ ] **Step 3: 完整检查**

Run: `pnpm check`

Expected: lint、typecheck、test、build、dist test 全部退出码 0。

- [ ] **Step 4: 提交严格模式**

```bash
git add src tsconfig.json tests lib
git commit -m "build: enforce strict typescript sources"
```

### Task 15: 增加跨平台 CI 与构建产物门禁

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: `pnpm-lock.yaml`、`pnpm check`、提交的 `lib/`。
- Produces: Windows/Linux 自动验收与可安装产物保证。

- [ ] **Step 1: 创建测试矩阵**

`ci.yml` 在 `ubuntu-latest` 与 `windows-latest`、Node 22 上执行：

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
- run: pnpm install --frozen-lockfile
- run: pnpm lint
- run: pnpm typecheck
- run: pnpm test
- run: pnpm build
- run: pnpm test:dist
```

- [ ] **Step 2: 增加生成物一致性 job**

只在 Ubuntu 执行：

```yaml
- run: git diff --exit-code -- lib
```

Expected: 源码未同步生成物时 CI 失败并显示 `lib/` diff。

- [ ] **Step 3: 更新开发文档**

README 记录 Node/pnpm 要求、`pnpm install`、`pnpm build:watch`、`pnpm check`，并说明用户安装使用提交的 `lib/`，无需全局 TypeScript。

- [ ] **Step 4: 本地复现 CI**

Run: `pnpm install --frozen-lockfile && pnpm check && git diff --exit-code -- lib`

Expected: 全部退出码为 0。

- [ ] **Step 5: 提交 CI**

```bash
git add .github/workflows/ci.yml package.json README.md lib
git commit -m "ci: verify typescript build on windows and linux"
```

### Task 16: 执行 Yunzai 双宿主发布验收

**Files:**
- Create: `docs/typescript-migration-verification.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Miao-Yunzai、TRSS-Yunzai、旧用户配置和脱敏数据库副本。
- Produces: 可审计的人工验收记录与发布说明。

- [ ] **Step 1: 在 Miao-Yunzai 执行验收矩阵**

逐项记录第 4.3 节场景的时间、适配器、结果和日志位置；完整运行一次抖音/B 站推送周期。

- [ ] **Step 2: 在 TRSS-Yunzai 执行验收矩阵**

使用相同配置副本执行同一矩阵，重点记录 `Bot`、消息元素、合并转发和 adapter 字段差异。

- [ ] **Step 3: 验证回滚**

停止实例，切换到迁移前 tag，再使用同一配置和 DB 启动；确认无需数据转换即可运行，然后切回 TypeScript 版本。

- [ ] **Step 4: 写发布说明**

CHANGELOG 明确源码迁移、Node 最低版本、运行行为不变、`lib/` 为构建产物，以及贡献者需要运行 `pnpm check`。

- [ ] **Step 5: 提交验收记录**

```bash
git add docs/typescript-migration-verification.md CHANGELOG.md
git commit -m "docs: record typescript migration verification"
```

## 7. 自审结果

### 7.1 需求覆盖

- 已覆盖三个参考仓库的源码/产物分层、入口桥接、loader、类型包、构建与发布实践。
- 已针对本仓库补充数据库、Express、锅巴、资源路径、宿主相对导入与多适配器约束。
- 已定义渐进迁移顺序、每阶段测试门、最终完成定义和无数据变更回滚方案。

### 7.2 关键决策一致性

- 全文统一使用 `src -> lib`、NodeNext ESM、相对导入 `.js` 后缀。
- loader 全文统一保持文件 basename 作为 app key，不改为类导出名。
- 插件根目录始终从 `src/dir.ts`/`lib/dir.js` 向上一层计算。
- 根主入口与锅巴入口保持独立桥接，锅巴不经过 bootstrap。
- 迁移期 `allowJs: true/checkJs: false`，最终 `allowJs: false`。

### 7.3 实施建议

优先以 Task 1-4 完成“可构建且行为等价”的基础设施，再开始业务文件改名。Task 5-13 每个任务都应独立评审和合并；数据库、抖音、Bilibili 三个高风险任务不要并行修改同一分支。Task 14-16 只在所有业务源码迁移完成后执行。
