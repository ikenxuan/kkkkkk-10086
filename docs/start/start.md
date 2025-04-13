# 简介

::: tip 编辑提示
如果文档中发现错误，或提交文档修改，或丰富本站文档，可点击下方的编辑按钮
:::

## 这是什么

_**这是一个基于 [抖音](https://www.douyin.com)、[bilibili](https://www.bilibili.com) 和 [快手](https://www.kuaishou.com) 的 WEB API 编写的<mark>自用</mark>辅助插件，提供对 Bot 的视频解析功能，通过接口获取数据并渲染图片返回**_<br>

> [!IMPORTANT]
> ### 该插件仅为小范围使用，暂无上架插件库意图<br>
> 主开发已跑路到 [Karin](https://github.com/KarinJS/Karin) 了，将使用可维护性更健壮的强类型语言 TypeScript 重写插件逻（JavaScript没类型和注释我写不下去了）。新仓库：https://github.com/ikenxuan/karin-plugin-kkk<br>
> 云崽版（该仓库）可能将由社区开发者维护。

Q: 什么时候回归？
A: 等云崽有完整的类型声明、代码注释和文档吧。（Yunzai Next？难评。）

可前往 [孪生版本](https://github.com/ikenxuan/karin-plugin-kkk) 查看<br>
本项目可能会停滞...<br>
<p>
<img src="https://img.shields.io/badge/-Node.js-3C873A?style=flat&logo=Node.js&logoColor=white" alt="Nodejs" style="display: inline-block;" />&nbsp;
<img src="https://img.shields.io/badge/-JavaScript-eed718?style=flat&logo=javascript&logoColor=ffffff" alt="JavaScript" style="display: inline-block;" />&nbsp;
<img src="https://img.shields.io/github/stars/ikenxuan/kkkkkk-10086" alt="GitHub stars" style="display: inline-block;" />&nbsp;
<img src="https://img.shields.io/github/forks/ikenxuan/kkkkkk-10086" alt="GitHub forks" style="display: inline-block;" />&nbsp;
<br>
<img src="https://img.shields.io/github/license/ikenxuan/kkkkkk-10086" alt="GitHub forks" style="display: inline-block;" />&nbsp;
<img src="https://img.shields.io/github/v/release/ikenxuan/kkkkkk-10086" alt="GitHub Release" style="display: inline-block;" />&nbsp;


</p>

### 特点

- 全部使用官方接口，快速 ~~稳定~~<br>
- 不会出现调用次数过多时 `服务商突然跑路` 或 `被服务商拉黑` 的问题<br>
- 支持譬如 _评论_ _番剧_ 等等的解析功能<br>

### 缺点
- 需请求的接口过多，要配置账号信息，如提供 `cookies`

::: details 鸣谢
**业务站点**

- [www.douyin.com](https://www.douyin.com) & [www.bilibili.com](https://www.bilibili.com) & [www.kuaishou.com](https://www.kuaishou.com)

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

- [SocialSisterYi/bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)
- [NearHuiwen/TiktokDouyinCrawler](https://github.com/NearHuiwen/TiktokDouyinCrawler)
- [B1gM8c/X-Bogus](https://github.com/B1gM8c/X-Bogus)
- [ikenxuan/amagi](https://github.com/ikenxuan/amagi)

**友情链接**

- Miao-Yunzai [**GitHub**](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [**Gitee**](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
- TRSS-Yunzai [**GitHub**](https://github.com/TimeRainStarSky/Yunzai) | [**Gitee**](https://gitee.com/TimeRainStarSky/Yunzai)
- Yunzai-Bot 插件库 [**Github**](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [**Gitee**](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index)
- ~~Lain-plugin [**GitHub**](https://github.com/Loli-Lain/Lain-plugin) | [**Gitee**](https://gitee.com/Zyy955/Lain-plugin)~~
- ICQQ Protocol [**GitHub**](https://github.com/icqqjs/icqq)
- Karin 框架 [**GitHub**](https://github.com/Karinjs/Karin) | [**文档**](https://karinjs.github.io/Karin)
- Yunzai V4 [**GitHub**](https://github.com/yunzai-org/yunzaijs) | [**文档**](https://yunzai-org.github.io/docs)
:::

开源协议: [**GPL-3.0**](https://github.com/ikenxuan/kkkkkk-10086/blob/master/LICENSE)

## 反馈渠道

<NCard title='<i class="fa-regular fa-comment-dots fa-bounce" style="color: #FFB805;"></i> 底部发表评论' >
在每个功能页面的的底部通过 GitHub 登录后可发表对应功能的建议和反馈
</NCard>
<NCard title='<i class="fa-solid fa-envelope fa-shake" style="color: #FFB805;"></i> 通过 GitHub issue' link="https://github.com/ikenxuan/kkkkkk-10086/issues/new/choose" >
也可以给通过创建新的 GitHub issue 工单
</NCard>

本站总访问量 <span id="busuanzi_value_site_pv" /> 次

![Star History Chart](https://api.star-history.com/svg?repos=ikenxuan/kkkkkk-10086&type=Date)
