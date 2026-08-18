> [!IMPORTANT]
>
> ### 该插件仅为小范围使用，暂无上架插件库意图<br>
>
> 主开发已跑路到 [Karin](https://github.com/KarinJS/Karin) 了，使用开发效率更高和可维护性更健壮的强类型语言 TypeScript 重写插件逻（JavaScript 没类型和注释我写不下去了）。新仓库：https://github.com/ikenxuan/karin-plugin-kkk<br>
> 云崽版（该仓库）将由社区开发者维护。
> 有问题及时提ISSUE

🦄 _**kkk插件（yunzai） 是一个 [Miao-Yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai) & [TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai) 的自用辅助插件，提供对 Bot 的视频解析功能，更多信息请移步[文档](https://ikenxuan.github.io/kkkkkk-10086)**_<img src="https://media.giphy.com/media/mGcNjsfWAjY5AEZNw6/giphy.gif" width="50">

![Nodejs](https://img.shields.io/badge/-Node.js-3C873A?style=flat&logo=Node.js&logoColor=white)
![JavaScript](https://img.shields.io/badge/-JavaScript-eed718?style=flat&logo=javascript&logoColor=ffffff)
[![GitHub stars](https://img.shields.io/github/stars/ikenxuan/kkkkkk-10086)](https://github.com/ikenxuan/kkkkkk-10086/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/ikenxuan/kkkkkk-10086)](https://github.com/ikenxuan/kkkkkk-10086/network)

<div>

[![GitHub License](https://img.shields.io/github/license/ikenxuan/kkkkkk-10086)](https://github.com/ikenxuan/kkkkkk-10086/blob/master/LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/ikenxuan/kkkkkk-10086)](https://github.com/ikenxuan/kkkkkk-10086/releases)
[![问题反馈](https://img.shields.io/badge/%E9%97%AE%E9%A2%98%E5%8F%8D%E9%A6%88-795874649-blue)](https://qm.qq.com/q/JqU2EbMeAu)

<div>

# [点击立即阅读插件文档](https://ikenxuan.github.io/kkkkkk-10086/) 📖

## 源码、构建产物与本地验证

本仓库以 `src/` 中的 TypeScript 为源码真源，`pnpm build` 会清理并重新生成 `lib/` 中的 JavaScript 构建产物。根入口会直接加载已提交的 `lib/`，因此修改源码时必须同步更新并提交对应的构建产物。

本地验证需要 Node.js 22 和 pnpm 9.15.9：

```bash
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` 会先执行完整的 `pnpm check`（代码风格、类型检查、测试、构建和构建产物契约），随后通过 `git diff --exit-code -- lib` 检查构建后的 `lib/` 是否与仓库记录一致。若最后一步失败，请检查构建差异并将预期的 `lib/` 更新与源码一起提交。

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

**接口文档与加密参数算法**

- [ikenxuan/amagi](https://github.com/ikenxuan/amagi)

**友情链接**

- Miao-Yunzai ☞ [**GitHub**](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [**Gitee**](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
- TRSS-Yunzai ☞ [**GitHub**](https://github.com/TimeRainStarSky/Yunzai) | [**Gitee**](https://gitee.com/TimeRainStarSky/Yunzai)
- Yunzai-Bot 插件库 ☞ [**Github**](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [**Gitee**](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index)
- ~~Lain-plugin ☞ [**GitHub**](https://github.com/Loli-Lain/Lain-plugin) | [**Gitee**](https://gitee.com/Zyy955/Lain-plugin)~~
- icqq 协议 ☞ [**GitHub**](https://github.com/icqqjs/icqq)
- Karin 框架 ☞ [**GitHub**](https://github.com/Karinjs/Karin) | [**文档**](https://karin.fun)
