
# 安装插件
::: tip 注意
支持 [**Miao-Yunzai V3**](https://github.com/yoimiya-kokomi/Miao-Yunzai) 、[**TRSS-Yunzai V3**](https://github.com/TimeRainStarSky/Yunzai) 、[**Yunzai Next**](https://github.com/yunzai-org/yunzaijs) 、[**Karin**](https://github.com/Karinjs/Karin)<br>
:::
## 获取源码

### 使用 Git 克隆（推荐）

机器人目录下打开终端执行
#### Yunzai
::: code-group

```sh [GitHub]
git clone --depth=1 https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```

```sh [Ghproxy]
git clone --depth=1 https://ghp.ci/https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```

```sh [Gitee 可能更新不及时]
git clone --depth=1 https://gitee.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```



:::

#### Karin
Karin 框架文档: **https://karinjs.github.io/Karin**<br>
Karin 用户 <mark>**务必使用**</mark> 以下的命令安装，否则插件可能不会被识别

::: code-group

```sh [GitHub]
git clone --depth=1 https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/karin-plugin-kkkkkk-10086/
```

```sh [Ghproxy]
git clone --depth=1 https://ghp.ci/https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/karin-plugin-kkkkkk-10086/
```

```sh [Gitee 可能更新不及时]
git clone --depth=1 https://gitee.com/ikenxuan/kkkkkk-10086.git ./plugins/karin-plugin-kkkkkk-10086/
```
:::


### 使用 Release 发行版（不推荐）

<details>
<summary>点击展开</summary>

<p style="color: red; font-weight: bolder;">不推荐该方式，后续无法通过 Git 进行更新</p>

1. 打开 Release 页面: https://github.com/ikenxuan/kkkkkk-10086/releases
2. 找到最新的版本，下载后缀名为 `.zip` 的压缩包
3. 在 `机器人根目录/plugins/` 中解压该压缩包
4. 完成后插件应在 `机器人根目录/plugins/kkkkkk-10086/`<br>[Karin](#获取源码) 则为 `机器人目录/plugins/karin-plugin-kkkkkk-10086/`


你可以在此处查看发布过的所有版本: [**版本历史**](../other/timeline.md)
</details>

## 安装依赖
二选一
1. 根目录下执行
```sh
pnpm install --filter=kkkkkk-10086
```
2. 插件目录下执行
```sh
cd plugins/kkkkkk-10086
pnpm install -P
```
