# bilibili 视频解析

---

插件会自动识别 `B站的分享链接`[^1] 进行解析

| 功能          | 支持情况            | 是否需要配置 ck                                        | 其他 |
| ------------- | ------------------- | ------------------------------------------------------ | - |
| 扫码登录取 ck | 支持                |                                                        | 命令: _**#B站扫码登录**_ |
| 视频          | 支持                | 默认画质 `360p` 设置后 `720p/1080p`，有大会员最高 `4K` | |
| 评论          | 支持                | 否                                                     | |
| 番剧          | 支持                | 可能，看剧集是否需要大会员                             | |
| 动态          | 图文/纯文/纯图      | 必须                                                   | |
| 动态推送      | 图文/纯文/视频/直播 | 必须                                                   | 如何设置推送UP请看 [**动态推送**](./push.md) |
| ...           | ...                 | ...                                                    | |

---
[^1]: B站的分享链接: 包括 `APP分享`、`web地址`、`小程序分享`
::: details 如何配置 B 站 `Cookie`

### 浏览器

找到携带 Cookie 的请求复制请求头中的 Cookie
![img](../../public/intro/pic1.png)

### 移动端

使用 [via 浏览器](https://res.viayoo.com/v1/via-release-cn.apk) 访问 [bilibili](https://www.bilibili.com/) 网页版并登录，点击 `左上角按钮` => `查看 Cookies` => `复制文本`

### 配置 Cookie

获取到 Cookie 后 使用 `#kkk设置B站ck` 后发送 Cookie 即可配置成功<br><br>
或者使用 [**后台面板**](../start/start.config.md) 进行配置<br><br>
手动配置则需要打开配置文件 `config/config/cookies.yaml` ，根据提示将对应的值替换成你获取到的 Cookie

```yaml{5}
# 抖音ck
douyin:

# B站ck，注意冒号后有个空格！ // [!code focus]
bilibili: 此处填上你的B站ck // [!code focus]
```

:::
