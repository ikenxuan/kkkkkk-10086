# bilibili 视频解析

---

插件会自动识别 `B站的分享链接`[^1] 进行解析<br>
如何配置B站ck？请看 [**其他功能**](../other.md#配置不同平台的-cookies)


| 功能          | 支持情况 | 调用相关接口是否需要 ck | 其他                                                                                  |
| ------------- | -------- | ----------------------- | ------------------------------------------------------------------------------------- |
| 扫码登录取 ck | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       |                         | 命令: _**#B站扫码登录**_                                                             |
| 视频          | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-question fa-bounce" style="color: #FFD43B;"></i>                      | 无 ck 默认画质 `360p`，有 ck 将尝试发送可观看的最高分辨率                             |
| 评论          | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-xmark fa-beat-fade fa-lg" style="color: #58fe79;"></i>                      |                                                                                       |
| 番剧          | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-question fa-bounce" style="color: #FFD43B;"></i>                      | 看剧集是否需要大会员                                                                  |
| 动态          | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #ff0000;"></i>                                                          |
| 直播          | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-xmark fa-beat-fade fa-lg" style="color: #58fe79;"></i>                      |                                                                                       |
| 动态推送      | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #58fe79;"></i>       | <i class="fa-solid fa-check fa-shake fa-lg" style="color: #ff0000;"></i>                      | 支持的动态类型: 图文/纯文/视频/直播<br>如何设置推送 UP 请看 [**动态推送**](../push.md) |
| ...           | ...      | ...                     |                                                                                       |

---

[^1]: B 站的分享链接: 包括 `APP分享`、`web地址`、`小程序分享`
