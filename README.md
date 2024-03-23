# kkkkkk-10086

[**Miao-Yunzai**](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [**TRSS-Yunzai / ICQQ 适配器**](https://github.com/TimeRainStarSky/Yunzai) 的自用辅助插件

反馈群：[795874649](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=S8y6baEcSkO6TEO5kEdfgmJhz79Oxdw5&authKey=ficWQytHGz3KIv5i0HpGbEeMBpABBXfjEMYRzo3ZwMV%2B0Y5mq8cC0Yxbczfa904H&noverify=0&group_code=795874649)

## 安装

### 机器人根目录下打开终端任选一条执行

```sh
# （国外推荐）使用 GitHub
git clone --depth=1 https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/

# （国内推荐）使用 Gitee
git clone --depth=1 https://gitee.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/

# （国内推荐）使用 ghproxy
git clone --depth=1 https://mirror.ghproxy.com/https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```

```sh
cd plugins/kkkkkk-10086
# 安装依赖 任选一个（可装可不装）
yarn --production
pnpm install -P
npm install --production
```

## 功能

> 使用**抖音**官方接口，解析视频并渲染评论图片返回
>
> - 会自动识别抖音分享链接并进行解析
> - 抖音用户更新推送（刚写完，可能有 bug）

---

> [!CAUTION]  
> `TRSS-Yunzai`用户必须安装依赖，否则无法使用  
> 使用前必须配置抖音 Cookie

<details><summary>管理命令</summary>

- #?kkk设置
- #kkk设置抖音ck
- #kkk设置视频解析(开启|关闭)
- #kkk设置默认视频解析(开启|关闭)
- #kkk设置缓存删除(开启|关闭)
- #kkk设置评论(开启|关闭)
- #kkk设置评论图片(开启|关闭)
</details>

> [!TIP]  
> 本插件配置文件使用`JSON`格式，非常见的`YAML`格式，，建议使用 [**Guoba-Plugin**](https://github.com/guoba-yunzai/guoba-plugin.git) 进行配置文件的修改。配置文件路径：
>
> ```sh
> # 初次使用自动创建
> 机器人目录/plugins/kkkkkk-10086/config/config.json
> ```

## TODO

**先挖坑，可能会咕咕咕**

- [ ] TRSS-Yunzai 的更多适配器
- [ ] Miao-Yunzai / [Lain-Plugin](https://github.com/Loli-Lain/Lain-plugin) 的更多适配器
- [ ] 重构

## 参考

- [xiaofei-plugin](https://gitee.com/xfdown/xiaofei-plugin)

- [chatgpt-plugin](https://github.com/ikechan8370/chatgpt-plugin)

- [X-Bogus](https://github.com/B1gM8c/X-Bogus)

- [rconsole-plugin](https://gitee.com/kyrzy0416/rconsole-plugin)

- [reset-qianyu-plugin](https://gitee.com/think-first-sxs/reset-qianyu-plugin)

## 友情链接

- Miao-Yunzai ☞ [**GitHub**](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [**Gitee**](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
- TRSS-Yunzai ☞ [**GitHub**](https://github.com/TimeRainStarSky/Yunzai) | [**Gitee**](https://gitee.com/TimeRainStarSky/Yunzai)
- Yunzai-Bot 插件库 ☞ [**Github**](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [**Gitee**](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index)
- Lain-plugin ☞ [**GitHub**](https://github.com/Loli-Lain/Lain-plugin) | [**Gitee**](https://gitee.com/Zyy955/Lain-plugin)
