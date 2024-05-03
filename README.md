# kkkkkk-10086

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

| 功能           | 支持情况 | 是否需要配置 ck | 平台 |
| -------------- | -------- | --------------- | ---- |
| 视频           | 支持     | 是              | 抖音 |
| 图集           | 支持     | 是              | 抖音 |
| 评论           | 支持     | 是              | 抖音 |
| 用户主视频列表 | 初步支持 | 是              | 抖音 |
| 视频更新推送   | 支持     | 是              | 抖音 |
| ...            | ...      | ...             | ...  |

| 功能                 | 支持情况 | 是否需要配置 ck                     | 是否需要大会员 | 平台 |
| -------------------- | -------- | ----------------------------------- | -------------- | ---- |
| 视频                 | 支持     | 默认画质 `360p` 设置后 `720p/1080p` | 有则最高 `4K`  | B 站 |
| 评论                 | 支持     | 否                                  | 否             | B 站 |
| 番剧                 | 支持     | 是                                  | 看剧集是否需要 | B 站 |
| 动态(图文/纯文/纯图) | 支持     | 是                                  | 否             | B 站 |
| 扫码登录取 ck        | 支持     |                                     |                | B 站 |
| ...                  | ...      | ...                                 | ...            | ...  |

想到什么写什么(有时间精力的情况下)

---

<details><summary>管理命令（仍未完善）</summary>

- #?kkk 设置
- #kkk 设置抖音 ck
- #kkk 设置视频解析(开启|关闭)
- #kkk 设置默认视频解析(开启|关闭)
- #kkk 设置缓存删除(开启|关闭)
- #kkk 设置评论(开启|关闭)
- #kkk 设置评论图片(开启|关闭)
</details>

> [!TIP]  
> 本插件配置文件使用`JSON`格式，非常见的`YAML`格式，建议使用 [**Guoba-Plugin**](https://github.com/guoba-yunzai/guoba-plugin.git) 进行配置文件的修改。配置文件路径：
>
> ```sh
> # 初次使用自动创建
> 机器人目录/plugins/kkkkkk-10086/config/config.json
> ```

> [!NOTE]
>
> ### **如何获取 ck？**
>
> 获取 ck 后使用命令`#kkk设置(抖音/B站)ck` => `发送获取到的ck`
>
> - **浏览器** (抖音 / 哔哩哔哩同理)  
>   找到携带 Cookie 的请求复制请求头中的 Cookie  
>   ![img](./resources/pic/pic1.png)
> - **手机**  
>   使用 [via 浏览器](https://res.viayoo.com/v1/via-release-cn.apk) 访问 [抖音](https://www.douyin.com/)/[哔哩哔哩](https://www.bilibili.com/) 网页版并登录，点击 `左上角按钮` => `查看 Cookies` => `复制文本`

## 参考

排名不分先后

- [xiaofei-plugin](https://gitee.com/xfdown/xiaofei-plugin)

- [chatgpt-plugin](https://github.com/ikechan8370/chatgpt-plugin)

- [X-Bogus](https://github.com/B1gM8c/X-Bogus)

- [rconsole-plugin](https://gitee.com/kyrzy0416/rconsole-plugin)

- [reset-qianyu-plugin](https://gitee.com/think-first-sxs/reset-qianyu-plugin)

- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect/)

## 友情链接

- Miao-Yunzai ☞ [**GitHub**](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [**Gitee**](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
- TRSS-Yunzai ☞ [**GitHub**](https://github.com/TimeRainStarSky/Yunzai) | [**Gitee**](https://gitee.com/TimeRainStarSky/Yunzai)
- Yunzai-Bot 插件库 ☞ [**Github**](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [**Gitee**](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index)
- ~~Lain-plugin ☞ [**GitHub**](https://github.com/Loli-Lain/Lain-plugin) | [**Gitee**](https://gitee.com/Zyy955/Lain-plugin)~~
