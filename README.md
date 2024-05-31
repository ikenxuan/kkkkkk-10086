![kkkkkk-10086](https://socialify.git.ci/ikenxuan/kkkkkk-10086/image?font=Inter&forks=1&issues=1&language=1&name=1&owner=1&pattern=Plus&pulls=1&stargazers=1&theme=Auto)

[**Miao-Yunzai**](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [**TRSS-Yunzai**](https://github.com/TimeRainStarSky/Yunzai) 的自用辅助插件

反馈群：[795874649](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=S8y6baEcSkO6TEO5kEdfgmJhz79Oxdw5&authKey=ficWQytHGz3KIv5i0HpGbEeMBpABBXfjEMYRzo3ZwMV%2B0Y5mq8cC0Yxbczfa904H&noverify=0&group_code=795874649)

## 安装

```sh
# 机器人目录下打开终端任选一条执行

# （国外推荐）使用 GitHub
git clone --depth=1 https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/

# （国内推荐）使用 Gitee
git clone --depth=1 https://gitee.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/

# （国内推荐）使用 ghproxy
git clone --depth=1 https://mirror.ghproxy.com/https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```

```
cd plugins/kkkkkk-10086
```

```sh
# 安装依赖 任选一条
yarn --production
pnpm install -P
npm install --production
```

## 功能

**抖音** | **哔哩哔哩** 视频解析

| 功能           | 支持情况         | 是否需要配置 ck | 平台 |
| -------------- | ---------------- | --------------- | ---- |
| 扫码登录取 ck  | 风控太严，做不了 |                 | 抖音 |
| 视频           | 支持             | 必须            | 抖音 |
| 图集           | 支持             | 必须            | 抖音 |
| 评论           | 支持             | 必须            | 抖音 |
| 用户主视频列表 | 初步支持         | 必须            | 抖音 |
| 视频更新推送   | 视频/图集/直播   | 必须            | 抖音 |
| ...            | ...              | ...             | ...  |

| 功能          | 支持情况            | 是否需要配置 ck                                             | 平台 |
| ------------- | ------------------- | ----------------------------------------------------------- | ---- |
| 扫码登录取 ck | 支持                |                                                             | B 站 |
| 视频          | 支持                | 默认画质 `360p` 设置后 `720p/1080p`，有大会员最高 `4K` B 站 |
| 评论          | 支持                | 否                                                          | B 站 |
| 番剧          | 支持                | 可能，看剧集是否需要大会员 B 站                             |
| 动态          | 图文/纯文/纯图      | 必须                                                        | B 站 |
| 动态推送      | 图文/纯文/视频/直播 | 必须                                                        | B 站 |
| ...           | ...                 | ...                                                         | ...  |

想到什么写什么(有时间精力的情况下)

---

更多信息可使用 `#kkk设置` `#kkk帮助` `#kkk版本`查看

> [!TIP]  
> 本插件配置文件使用`JSON`格式，非常见的`YAML`格式，建议使用 [**Guoba-Plugin**](https://github.com/guoba-yunzai/guoba-plugin) 进行配置文件的修改。配置文件路径：
>
> ```sh
> # 初次使用自动创建
> 机器人目录/plugins/kkkkkk-10086/config/config.json
> ```

> [!NOTE]
>
> ### **如何手动获取ck？**
>
> 获取 ck 后使用命令 `#kkk设置(抖音/B站)ck` => `发送获取到的ck`
>
> - **浏览器** (抖音 / 哔哩哔哩同理)  
>   找到携带 Cookie 的请求复制请求头中的 Cookie  
>   ![img](./resources/pic/pic1.png)
> - **手机**  
>   使用 [via 浏览器](https://res.viayoo.com/v1/via-release-cn.apk) 访问 [抖音](https://www.douyin.com/)/[哔哩哔哩](https://www.bilibili.com/) 网页版并登录，点击 `左上角按钮` => `查看 Cookies` => `复制文本`

> [!CAUTION]
> ### 关于抖音ck
> 本项目的抖音API接口全部取自其 [web端站点](https://www.douyin.com) ，风控非常严格，导致ck可能频繁失效，当抖音业务出现问题时建议优先更换ck重试
> 
> **更多的解决方法：**
> - 抖音推送博主数量不宜过多（< 15个）
> - 抖音推送定时任务间隔（> 10分钟一次）
> - 同一ck不要频繁异地调用

## 鸣谢

本项目的开发参考了以下开源项目部分代码，排名不分先后

**业务站点**
- [wwww.douyin.com](https://www.douyin.com) & [www.bilibili.com](https://www.bilibili.com)

**部分代码借鉴**
- [xiaofei-plugin](https://gitee.com/xfdown/xiaofei-plugin)
- [chatgpt-plugin](https://github.com/ikechan8370/chatgpt-plugin)
- [rconsole-plugin](https://gitee.com/kyrzy0416/rconsole-plugin)
- [reset-qianyu-plugin](https://gitee.com/think-first-sxs/reset-qianyu-plugin)
- [yenai-plugin](https://github.com/yeyang52/yenai-plugin)

**接口文档与加密参数算法**
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)
- [TiktokDouyinCrawler](https://github.com/NearHuiwen/TiktokDouyinCrawler)
- [X-Bogus](https://github.com/B1gM8c/X-Bogus)


## 友情链接

- Miao-Yunzai ☞ [**GitHub**](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [**Gitee**](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
- TRSS-Yunzai ☞ [**GitHub**](https://github.com/TimeRainStarSky/Yunzai) | [**Gitee**](https://gitee.com/TimeRainStarSky/Yunzai)
- Yunzai-Bot 插件库 ☞ [**Github**](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [**Gitee**](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index)
- ~~Lain-plugin ☞ [**GitHub**](https://github.com/Loli-Lain/Lain-plugin) | [**Gitee**](https://gitee.com/Zyy955/Lain-plugin)~~

## 免责声明

本项目提供的开源代码是出于学习进行开发。如果您认为该项目侵犯了您的知识产权或其他合法权益，请通过 **[QQ](https://qm.qq.com/q/k6Up32hdWE)** 向我们提供书面通知。我们将在收到有效通知后，尽快进行审查，并采取必要的措施。

本软件出于学习进行开发，使用本项目的使用本软件的用户应确保遵守所有适用的开源许可证协议，并且在使用过程中尊重原作者的知识产权。

此外，未经同意，禁止将本项目的开源代码用于任何商业目的。

我们保留随时修改本免责声明的权利，并且这些修改将立即生效。
