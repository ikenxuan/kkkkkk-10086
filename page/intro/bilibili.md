# bilibili视频解析
---
插件会自动识别 `B站的分享链接` 进行解析

| 功能          | 支持情况            | 是否需要配置 ck                                             |
| ------------- | ------------------- | ----------------------------------------------------------- |
| 扫码登录取 ck | 支持                |                                                             |
| 视频          | 支持                | 默认画质 `360p` 设置后 `720p/1080p`，有大会员最高 `4K` | B 
| 评论          | 支持                | 否                                                          |
| 番剧          | 支持                | 可能，看剧集是否需要大会员                              |B 
| 动态          | 图文/纯文/纯图      | 必须                                                        |
| 动态推送      | 图文/纯文/视频/直播 | 必须                                                        |
| ...           | ...                 | ...                                                         |
---
::: details 如何配置B站 `Cookie`
### 浏览器

找到携带 Cookie 的请求复制请求头中的 Cookie
![img](./imgs/pic1.png)
### 移动端

使用 [via 浏览器](https://res.viayoo.com/v1/via-release-cn.apk) 访问 [bilibili](https://www.bilibili.com/) 网页版并登录，点击 `左上角按钮` => `查看 Cookies` => `复制文本`
### 配置 Cookie
获取到 Cookie 后 使用 `#kkk设置B站ck` 后发送 Cookie 即可配置成功<br>
或者使用 [**Guoba-Plugin**](https://github.com/guoba-yunzai/guoba-plugin) 进行配置<br>
手动配置则需要打开配置文件找到该键值，将值替换成你获取到的 Cookie
```json{3}
"douyinpushcron": "*/10 * * * *",
"douyinpushGroup": "master",
"bilibilick": "", // [!code focus]
"bilibilirefresh_token": "",
"sendforwardmsg": true,
"bilibilicommentsimg": true,
```

:::