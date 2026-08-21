> [!IMPORTANT]
>
> ### 该插件仅为小范围使用，暂无上架插件库意图<br>
>
> 主开发已跑路到 [Karin](https://github.com/KarinJS/Karin) 了，使用开发效率更高和可维护性更健壮的强类型语言 TypeScript 重写插件逻（JavaScript 没类型和注释我写不下去了）。新仓库：https://github.com/ikenxuan/karin-plugin-kkk<br>
> 云崽版（该仓库）将由社区开发者维护。
> 有问题及时提ISSUE

🦄 _**kkk插件（yunzai） 是一个 [Miao-Yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai) & [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) 的自用辅助插件，提供对 Bot 的视频解析功能，更多信息请移步[文档](https://ikenxuan.github.io/kkkkkk-10086)**_<img src="https://media.giphy.com/media/mGcNjsfWAjY5AEZNw6/giphy.gif" width="50">

![Nodejs](https://img.shields.io/badge/-Node.js-3C873A?style=flat&logo=Node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat&logo=typescript&logoColor=ffffff)
[![GitHub stars](https://img.shields.io/github/stars/ikenxuan/kkkkkk-10086)](https://github.com/ikenxuan/kkkkkk-10086/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ikenxuan/kkkkkk-10086)](https://github.com/ikenxuan/kkkkkk-10086/network)

<div>

[![GitHub License](https://img.shields.io/github/license/ikenxuan/kkkkkk-10086)](https://github.com/ikenxuan/kkkkkk-10086/blob/master/LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/ikenxuan/kkkkkk-10086)](https://github.com/ikenxuan/kkkkkk-10086/releases)
[![问题反馈](https://img.shields.io/badge/%E9%97%AE%E9%A2%98%E5%8F%8D%E9%A6%88-795874649-blue)](https://qm.qq.com/q/JqU2EbMeAu)

<div>

# [点击立即阅读插件文档](https://ikenxuan.github.io/kkkkkk-10086/) 📖

## 安装插件 📦

请先准备 [Miao-Yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai) 或 [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai)。插件要求 Node.js 22.12.0 及以上版本，推荐使用 pnpm 9.15.9。

普通用户应安装已经编译完成的 `master` 或 `preview` 分支，不需要在本地执行构建。请在 **Yunzai 根目录**任选一个版本安装。

### 预览版（开发版构建产物）

`preview` 会在 `dev` 更新并通过检查后自动构建，功能更新最快，但可能包含尚未进入正式版的改动。

```bash
git clone --depth=1 --branch preview https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086
pnpm install
```

### 稳定版（正式发布构建产物）

`master` 只在 `dev` 上的 release-please 发布 PR 合并后更新，适合希望优先保持稳定的用户。

```bash
git clone --depth=1 --branch master https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086
pnpm install
```

> [!NOTE]
>
> `master` 在首次正式发版后才会变成编译产物。在此之前它还是重写前的 JavaScript 源码，请先安装 `preview`。

安装或更新依赖后重启 Yunzai。后续可使用主人命令 `#kkk更新` 更新当前安装分支；依赖发生变化时，请再次在 Yunzai 根目录执行 `pnpm install`。

### 切换已安装的分支

上面的安装命令带了 `--depth=1 --branch xxx`，克隆出来的是**浅克隆 + 单分支**，git 只跟踪你当初选的那一条分支，所以直接 `git checkout master` 会报：

```
error: pathspec 'master' did not match any file(s) known to git
```

要换分支，得先让 git 认识目标分支，再切过去。在**插件目录**执行（把三处 `master` 换成你要切的分支名）：

```bash
cd ./plugins/kkkkkk-10086
git remote set-branches --add origin master
git fetch --depth=1 origin master
git checkout -B master origin/master
```

然后回到 **Yunzai 根目录**装一次依赖，再重启 Yunzai：

```bash
pnpm install
```

> [!NOTE]
>
> 你自己的配置不会丢：构建分支只跟踪 `config/default_config`，`config/config/` 和 `data/` 都不在版本控制里，切分支不会动它们。

> [!TIP]
>
> 切完之后 `#kkk更新` 更新的就是新分支，不需要额外设置。

切到源码分支（`dev`）用的是同一套命令，但源码分支不含 `lib/`，切过去必须自己构建才能运行，见下面的开发说明。

## 开发说明 🛠️

仓库采用“源码分支 → 构建分支”的发布方式：

| 源码分支 | 构建分支 | 用途 |
| --- | --- | --- |
| `dev` | `preview` | 日常开发；每次推送后由 Actions 检查、构建并发布预览版 |
| `dev` | `master` | 正式发布；release-please 的发布 PR 合并后构建并发布稳定版 |

`dev` 保存 TypeScript、React 模板与构建配置；`preview` 和 `master` 只保存运行所需文件及生成后的 `lib/`。请勿直接修改构建分支。

> [!NOTE]
>
> `master` 在重写前是 JavaScript 源码线，源码提交停在 2026-07-28，那批源码已在 `735910e` 清理（历史仍可取回）。它现在改作发布分支：发版后由 Actions 把编译产物推到 `master`。源码请一律以 `dev` 为准。

### 获取开发源码

在 Yunzai 根目录执行：

```bash
git clone --branch dev https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086
pnpm install
pnpm --dir ./plugins/kkkkkk-10086 check
```

`pnpm check` 会依次执行代码风格检查、源码类型检查、React 模板类型检查和完整构建。开发期间如需持续编译，可运行：

```bash
pnpm --dir ./plugins/kkkkkk-10086 build:watch
```

提交开发改动前请再次运行 `pnpm check`。`lib/`、`.generated/` 等生成目录不会提交，由 GitHub Actions 重新构建；`tests/**` 仅保留作本地验证并已被忽略，请勿强制加入 Git。

## 贡献者 🌟

> 🌟 星光闪烁，你们的智慧如同璀璨的夜空。感谢所有为 **kkk插件（yunzai）** 做出贡献的人！

[![贡献者](https://contributors-img.web.app/image?repo=ikenxuan/kkkkkk-10086)](https://github.com/ikenxuan/kkkkkk-10086/graphs/contributors)

![Alt](https://repobeats.axiom.co/api/embed/3396f5ddc7a64da4b9089a4193c2cb3ba40588f7.svg 'Repobeats analytics image')

[![Star History Chart](https://api.star-history.com/svg?repos=ikenxuan/kkkkkk-10086&type=Date)](https://star-history.com/#ikenxuan/kkkkkk-10086&Date)

## 免责声明 ❗

> [!CAUTION]
>
> **未经同意，禁止将本项目的开源代码用于任何商业目的。因使用本项目产生的一切问题与后果由使用者自行承担，项目开发者不承担任何责任**

我们保留随时修改本免责声明的权利，并且这些修改将立即生效。

## 鸣谢 😊

**业务站点**

- [wwww.douyin.com](https://www.douyin.com) & [www.bilibili.com](https://www.bilibili.com) & [www.kuaishou.com](https://www.kuaishou.com)

本项目的开发参考了以下开源项目部分代码，排名不分先后

**部分代码借鉴**

- [xfdown/xiaofei-plugin](https://gitee.com/xfdown/xiaofei-plugin)
- [ikechan8370/chatgpt-plugin](https://github.com/ikechan8370/chatgpt-plugin)
- [kyrzy0416/rconsole-plugin](https://gitee.com/kyrzy0416/rconsole-plugin)
- [think-first-sxs/reset-qianyu-plugin](https://gitee.com/think-first-sxs/reset-qianyu-plugin)
- [yeyang52/yenai-plugin](https://github.com/yeyang52/yenai-plugin)
- [XasYer/Shiranai-Plugin](https://github.com/XasYer/Shiranai-Plugin)
- ...

**TypeScript 工程结构参考**

- [KaguyaJs/Yunzai-DF-Plugin](https://github.com/KaguyaJs/Yunzai-DF-Plugin) —— 本项目从 JavaScript 迁移到 TypeScript 时，工程结构（构建产物布局、ESM 出口、类型组织方式）参考了该项目
- [KaguyaJs/TRSS-Yunzai-Types](https://github.com/KaguyaJs/TRSS-Yunzai-Types) —— 宿主全局声明，本项目以 `@types/trss-yunzai` 别名安装

**接口文档与加密参数算法**

- [ikenxuan/amagi](https://github.com/ikenxuan/amagi)

**友情链接**

- Miao-Yunzai ☞ [**GitHub**](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [**Gitee**](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
- TRSS-Yunzai ☞ [**GitHub**](https://github.com/TimeRainStarSky/Yunzai) | [**Gitee**](https://gitee.com/TimeRainStarSky/Yunzai)
- Yunzai-Bot 插件库 ☞ [**Github**](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [**Gitee**](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index)
- ~~Lain-plugin ☞ [**GitHub**](https://github.com/Loli-Lain/Lain-plugin) | [**Gitee**](https://gitee.com/Zyy955/Lain-plugin)~~
- icqq 协议 ☞ [**GitHub**](https://github.com/icqqjs/icqq)
- Karin 框架 ☞ [**GitHub**](https://github.com/Karinjs/Karin) | [**文档**](https://karin.fun)
