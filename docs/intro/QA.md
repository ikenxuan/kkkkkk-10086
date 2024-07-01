# 常见问题

::: details 报错：**<span style="color:#D7474B">TypeError: response.body.on is not a function</span>**
```sh
# 方法1：到插件目录下重新安装依赖（推荐）
cd plugins/kkkkkk-10086/ && pnpm install -P

# 方法2：node.js 版本 >= v21
nvm use 21.0.0
```
:::


::: details 报错：**<span style="color:#D7474B">FetchError: request to https://...</span>**
这是你的网络问题，自行排查是不是开了代理
:::


::: details 报错：**<span style="color:#D7474B">视频合成失败 Error: Command failed: ffmpeg -y -i ......</span>**
可能是你没有配置 [**FFmpeg**](https://ffmpeg.org/) 的环境变量<br>

* **Ubuntu 系统解决方法**<br>
安装完成后在终端输入 `ffmpeg –version` 弹出版本信息 `ffmpeg version 202...` 即安装成功
```sh
# 你可以通过以下命令来安装 FFmpeg 并配置环境变量
sudo apt install ffmpeg
```

* **Windows 系统解决方法**<br>
参考 CSDN 文章 [ffmpeg安装教程（windows版）](https://blog.csdn.net/m0_47449768/article/details/130102406)
:::



