# 抖音视频解析

---

插件会自动识别 `抖音的分享链接` 进行解析

| 功能              | 支持情况           | 是否需要配置 ck |
| ----------------- | ------------------ | --------------- |
| ~~扫码登录取 ck~~ | 风控太严，做不了   |                 |
| 视频              | 支持               | 必须            |
| 图集              | 支持               | 必须            |
| 评论              | 支持               | 必须            |
| 用户主视频列表    | 初步支持           | 必须            |
| 视频更新推送      | 视频/图集/~~直播~~ | 必须            |
| ...               | ...                | ...             |

---

::: details 如何配置抖音 `Cookie`

### 浏览器

找到携带 Cookie 的请求复制请求头中的 Cookie
![img](../../public/intro/pic1.png)

### 移动端

使用 [via 浏览器](https://res.viayoo.com/v1/via-release-cn.apk) 访问 [抖音](https://www.douyin.com/) 网页版并登录，点击 `左上角按钮` => `查看 Cookies` => `复制文本`

### 配置 Cookie

获取到 Cookie 后 使用 `#kkk设置抖音ck` 后发送 Cookie 即可配置成功<br><br>
或者使用 [**后台面板**](../start/start.config.md) 进行配置<br><br>
手动配置则需要打开配置文件 `config/config/cookies.yaml` ，根据提示将对应的值替换成你获取到的 Cookie

```yaml{2}
# 抖音ck，注意有个空格！
douyin: 此处填上你的抖音ck // [!code focus]

# B站ck
bilibili: 
```

:::

::: warning 注意！！

### 关于抖音 Cookie

本项目的抖音 API 接口全部取自其 [web 端站点](https://www.douyin.com) ，风控非常严格，`Cookie` 可能频繁失效，当抖音业务出现问题建议优先更换 `Cookie` 重试

**更多的解决方法：**

- 抖音推送定时任务间隔不宜过短
- 同一 `Cookie` 不要频繁异地调用
  :::
