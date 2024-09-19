# 常见问题

::: tip 编辑提示
如果文档中发现错误，或提交文档修改，或丰富本站文档，可点击下方的编辑按钮
:::




::: details 安装依赖报错：**<span style="color:#D7474B">node-pre-gyp ERR! build error......<br>node-pre-gyp ERR! not ok......</span>**
执行以下命令后再重新安装一次依赖
```sh
npm install -g node-gyp
```
:::




::: details 报错：**<span style="color:#D7474B">TypeError: response.body.on is not a function</span>**
```sh
# 方法1：到插件目录下重新安装依赖（推荐）
cd plugins/kkkkkk-10086/ && pnpm install -P

# 方法2：node.js 版本 >= v21
nvm use 21.0.0
```
:::






::: details 报错：**<span style="color:#D7474B">FetchError: request to https://......</span>**
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






::: details 报错：**<span style="color:#D7474B">TypeError: Cannot read properties of undefined (reading 'pickGroup')......</span>**
这种情况一般是主动发送推送图片的时候的错误<br>
造成这种错误的情况一般是你不久前 **_更换了机器人账号_** ，但是 `config/config/pushlist.yaml`中的<br>机器人账号还是旧的，导致找不到机器人账号从而报错

### 解决方法: 
* 手动修改 `config/config/pushlist.yaml` 中的旧机器人账号<mark>为当前机器人账号</mark>
* 通过命令或后台面板重新订阅推送博主/UP主

:::


