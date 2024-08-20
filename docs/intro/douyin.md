# 抖音视频解析

---

插件会自动识别 `APP分享链接`[^1] `web视频链接`[^2] 进行解析<br>
如何配置抖音ck？请看 [**其他功能**](./other.md#配置不同平台的-cookies)

| 功能           | 支持情况 | 调用相关接口是否需要 ck | 其他                                                                        |
| -------------- | -------- | ----------------------- | --------------------------------------------------------------------------- |
| 扫码登录取 ck  | <i class="fa-solid fa-xmark fa-beat-fade fa-lg" style="color: #f20707;"></i>       |                         | 风控太严格，无法实现                                                        |
| 视频           | 🟢       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #63E6BE;"></i>                      |                                                                             |
| 图集           | 🟢       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #63E6BE;"></i>                      |                                                                             |
| 评论           | 🟢       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #63E6BE;"></i>                      |                                                                             |
| 用户主视频列表 | 🟢       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #63E6BE;"></i>                      |                                                                             |
| 视频更新推送   | 🟢       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #63E6BE;"></i>                      | 支持的推送类型: 视频/图集<br>如何设置推送博主请看 [**动态推送**](./push.md) |
| ...            | ...      | ...                     |                                                                             |

---

[^1]: 抖音的分享链接: [`8.74 复制打开抖音，看看【Aleks Kost的作品】当代网友：这是亚当本人吧？ # 亚当仿妆# 用亚当... https://v.douyin.com/i6msCtFe/ l@P.KJ pDH:/ 12/11`](https://v.douyin.com/i6msCtFe/)

[^2]: web 视频链接: [`https://www.douyin.com/video/7375088329701854498`](https://www.douyin.com/video/7375088329701854498)

::: warning 注意！！

### 关于抖音 Cookie

本项目的抖音 API 接口全部取自其 [web 端站点](https://www.douyin.com) ，风控非常严格，`Cookie` 可能频繁失效，当抖音业务出现问题建议优先更换 `Cookie` 重试

**更多的解决方法：**

- 抖音推送定时任务间隔不宜过短
- 同一 `Cookie` 不要频繁异地调用
  :::
