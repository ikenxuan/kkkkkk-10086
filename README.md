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

- 抖音支持:

  - [x] 视频
  - [x] 图集
  - [x] 评论
  - [x] 用户主页视频列表
  - [ ] ...

  <br>

- B 站支持:

  - [x] 视频
  - [x] 评论
  - [x] 扫码登录取 ck
  - [x] 番剧(大部分情况刚需**大会员**)
  - [ ] ...

想到什么写什么(有时间精力的情况下)

---

<details><summary>管理命令</summary>

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

> [!CAUTION]  
> 抖音解析使用前必须配置抖音 `ck`  
> B 站解析不设置 `ck` 画质为 `360p`，设置后默认解析当前视频 `最高画质` 可能需要视频支持与 `大会员`

> [!NOTE]
>
> ### **如何获取 ck？**
>
> - **浏览器** (抖音 / 哔哩哔哩同理)  
>   找到携带 Cookie 的请求复制请求头中的 Cookie  
>   ![img](./resources/pic/pic1.png)
> - **手机**  
>   使用 [via 浏览器](https://res.viayoo.com/v1/via-release-cn.apk) 访问 [抖音](https://www.douyin.com/)/[哔哩哔哩](https://www.bilibili.com/) 网页版并登录，点击 `左上角按钮` => `查看 Cookies` => `复制文本`

## TODO

**先挖坑，可能会咕咕咕**

- [ ] TRSS-Yunzai 的更多适配器
- [ ] ~~Miao-Yunzai / [Lain-Plugin](https://github.com/Loli-Lain/Lain-plugin) 的更多适配器~~
- [ ] 快手
- [ ] 重构

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
