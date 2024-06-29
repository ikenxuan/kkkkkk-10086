# 配置文件

本插件配置项过多<br>
_**Yunzai**_ 生态用户建议使用 [**Guoba-Plugin**](https://github.com/guoba-yunzai/guoba-plugin) 进行配置文件的修改。<br>
_**Karin**_ 生态用户建议使用 [**Karin Manage**](https://github.com/HalcyonAlcedo/karin-plugin-manage) 进行配置文件的修改

``` json{4-9}
├─config // 插件配置文件目录
│  │  PluginConfigView.yaml // Karin Manage 配置文件（请勿修改该文件的任何内容！）
│  │
│  ├─config // 用户配置文件目录 // [!code focus]
│  │      app.yaml // 插件应用配置 // [!code focus]
│  │      bilibili.yaml // B站相关配置 // [!code focus]
│  │      cookies.yaml // 账号Cookies相关配置 // [!code focus]
│  │      douyin.yaml // 抖音相关配置 // [!code focus]
│  │      pushlist.yaml // 推送列表相关配置 // [!code focus]
│  │
│  └─default_config // 默认配置文件目录（请勿修改此目录下的任何文件！）
│          app.yaml // 含义同上
│          bilibili.yaml // 含义同上
│          cookies.yaml // 含义同上
│          douyin.yaml // 含义同上
│          pushlist.yaml // 含义同上
```

# TODO

- [x] 后续版本将使用 `YAML` 格式配置文件<br>由 [**@ikenxuan**](https://github.com/ikenxuan) 在 [**88fa787**](https://github.com/ikenxuan/kkkkkk-10086/commit/88fa787ea2365821deff71298ebc60f8adcd0815) 完成
