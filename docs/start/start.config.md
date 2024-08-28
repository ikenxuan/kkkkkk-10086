# 配置文件

本插件配置项过多<br>
_**Yunzai**_ 生态用户建议使用 [**Guoba-Plugin**](https://github.com/guoba-yunzai/guoba-plugin) 进行配置文件的修改。<br>
_**Karin**_ 生态用户建议使用 [**Karin Manage**](https://github.com/HalcyonAlcedo/karin-plugin-manage) 进行配置文件的修改

``` json{4-9}
├─config // 插件配置文件目录
│  │  PluginConfigView.yaml // Karin Manage 配置文件（请勿修改该文件的任何内容！）
│  │
│  ├─config // 用户配置文件目录，可修改该目录下的任何文件 // [!code focus]
│  │      app.yaml // 插件应用配置 // [!code focus]
│  │      bilibili.yaml // B站相关配置 // [!code focus]
│  │      cookies.yaml // 账号Cookies相关配置 // [!code focus]
│  │      douyin.yaml // 抖音相关配置 // [!code focus]
│  │      pushlist.yaml // 推送相关配置 // [!code focus]
│  │
│  └─default_config // 默认配置文件目录（请勿修改此目录下的任何文件！）
│          app.yaml // 含义同上
│          bilibili.yaml // 含义同上
│          cookies.yaml // 含义同上
│          douyin.yaml // 含义同上
│          pushlist.yaml // 含义同上
```

## 默认配置文件

::: details 插件应用配置
```yaml
# 视频解析工具总开关，修改后重启生效
videotool: true

# 默认解析，即识别最高优先级，修改后重启生效
defaulttool: true

# 自定义优先级，「默认解析」关闭后才会生效。修改后重启生效
priority: 800

# 发送合并转发消息，可能多用于抖音解析
sendforwardmsg: true

# 视频文件上传限制，开启后会根据解析的视频文件大小判断是否需要上传（B站番剧无影响）
usefilelimit: true

# 视频文件大小限制（填数字），视频文件大于该数值则不会上传 单位: MB，「视频文件上传限制」开启后才会生效（B站番剧无影响）
filelimit: 20

# 缓存删除，非必要不修改！
rmmp4: true

# 渲染精度，可选值50~200，建议100。设置高精度会提高图片的精细度，过高可能会影响渲染与发送速度
renderScale: 100

# 放出API服务（本地部署一个抖音、B站的api服务）
APIServer: false

# API服务端口
APIServerPort: 4567

# API服务日志
APIServerLog: false
```
:::

::: details B站相关配置
```yaml
# B站解析开关，单独开关，受「总开关」影响
bilibilitool: true

# B站解析提示，发送提示信息：“检测到B站链接，开始解析”
bilibilitip: true

# B站评论图，发送哔哩哔哩作品评论图
bilibilicommentsimg: true

# B站评论数量，设置接口返回的评论数量，范围1~20条
bilibilinumcomments: 5

# B站推送，开启后需重启；使用[#设置B站推送+用户UID]配置推送列表
bilibilipush: false

# B站推送日志，打开或关闭定时任务日志
bilibilipushlog: true

# B站推送设置权限，(all)所有人；(admin)群主和管理员；(owner)群主；(master)主人
bilibilipushGroup: master

# B站推送表达式
bilibilipushcron: '*/10 * * * *'

# 是否发送视频动态的视频
senddynamicvideo: false

# 解析视频是否优先保内容，true为优先保证上传将使用最低分辨率，false为优先保清晰度将使用最高分辨率
videopriority: false
```
:::

::: details 账号Cookies相关配置
```yaml
# 抖音ck
douyin:

# B站ck
bilibili:

# 快手ck
kuaishou: 
```
:::

::: details 抖音相关配置
```yaml
# 抖音解析开关，单独开关，受「总开关」影响
douyintool: true

# 抖音解析提示，发送提示信息：“检测到抖音链接，开始解析”
douyintip: true

# 抖音评论解析
comments: true

# 抖音评论数量，范围1~50条
numcomments: 5

# 发送抖音作品评论图
commentsimg: true

# 抖音推送，开启后需重启；使用[#设置抖音推送+抖音号]配置推送列表
douyinpush: false

# 抖音推送日志，打开或关闭定时任务日志
douyinpushlog: true

# 抖音推送设置权限，(all)所有人；(admin)群主和管理员；(owner)群主；(master)主人
douyinpushGroup: master

# 抖音推送表达式
douyinpushcron: '*/10 * * * *'

# 图集BGM是否使用高清语音发送，高清语音「ios/PC」系统均无法播放，自行衡量开关（仅icqq）
sendHDrecord: true
```
:::

::: details 推送相关配置
```yaml
# 快手解析开关，单独开关，受「总开关」影响
kuaishoutool: true

# 快手解析提示，发送提示信息：“检测到快手链接，开始解析”
kuaishoutip: true

# 快手评论数量，范围1~30条
kuaishounumcomments: 5
```
:::

::: details 推送相关配置
```yaml
# # 抖音推送列表
# douyin:
#   -
#     # 抖音用户（可不填，执行推送时会自动填上）
#     sec_uid: 
#     # 抖音号（必填）
#     short_id: 
#     # 推送群号和机器人账号，多个则使用逗号隔开（必填，例子：[12345678:87654321, 11451419:88888888]，群号就是11451419，机器人账号就是88888888）
#     group_id:
#       - 1145141919810:8888888888
#     # 这个博主的名字信息（可不填，执行推送时会自动填上）
#     remark: 

# # B站推送列表
# bilibili:
#   -
#     # B站用户（必填）
#     host_mid: 
#     # 推送群号和机器人账号，多个则使用逗号隔开（必填，例子：[12345678:87654321, 11451419:88888888]，群号就是11451419，机器人账号就是88888888）
#     group_id:
#       - 1145141919810:8888888888
#     # 这个UP主的名字信息（可不填，执行推送时会自动填上）
#     remark: 

# 抖音推送列表
douyin: 

# B站推送列表
bilibili: 
```
:::
# TODO
<Task status="已发布" content="后续版本将使用 `YAML` 格式配置文件。由 [**@ikenxuan**](https://github.com/ikenxuan) 在 [**88fa787**](https://github.com/ikenxuan/kkkkkk-10086/commit/88fa787ea2365821deff71298ebc60f8adcd0815) 完成"></Task>
