# 抖音视频解析

> [!IMPORTANT] 重要
> 抖音解析功能必须要配置 ck ，否则无法解析视频<br>如何配置抖音 ck ？请看 [**其他功能**](../other.md#配置不同平台的-cookies)
>

---

插件会自动识别 `APP分享链接`[^1] `web视频链接`[^2] 进行解析<br>

| 功能           | 支持情况 | 调用相关接口是否需要 ck | 其他                                                                        |
| -------------- | -------- | ----------------------- | --------------------------------------------------------------------------- |
| 扫码登录取 ck  | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       |                         | 仅支持 Windows 系统，命令：**_#抖音扫码登录_**                                   |
| 视频           | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #ff0000;"></i>                      |                                                                             |
| 图集           | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #ff0000;"></i>                      |                                                                             |
| 评论           | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #ff0000;"></i>                      |                                                                             |
| 用户主视频列表 | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #ff0000;"></i>                      |                                                                             |
| 背景音乐           | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #ff0000;"></i>                      |                                                                             |
| 视频更新推送   | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #ff0000;"></i>                      | 支持的推送类型: 视频/图集<br>如何设置推送博主请看 [**动态推送**](../push.md) |
| ...            | ...      | ...                     |                                                                             |

---

[^1]: 抖音的分享链接: [`8.74 复制打开抖音，看看【Aleks Kost的作品】当代网友：这是亚当本人吧？ # 亚当仿妆# 用亚当... https://v.douyin.com/i6msCtFe/ l@P.KJ pDH:/ 12/11`](https://v.douyin.com/i6msCtFe/)

[^2]: web 视频链接: [`https://www.douyin.com/video/7375088329701854498`](https://www.douyin.com/video/7375088329701854498)

::: warning 警告

### 关于抖音 Cookie

本项目的抖音 API 接口全部取自其 [web 端站点](https://www.douyin.com) ，风控非常严格，`Cookie` 可能频繁失效，当抖音业务出现问题建议优先更换 `Cookie` 重试

**更多的解决方法：**

- 抖音推送定时任务间隔不宜过短
- 同一 `Cookie` 不要频繁异地调用
  :::
