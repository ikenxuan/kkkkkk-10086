
# 安装插件
::: tip 注意
支持 `Miao-Yunzai V3` `TRSS-Yunzai V3` `Yunzai V4` `Karin`<br>
:::
## 获取源码

### 使用 Git 克隆（推荐）

机器人目录下打开终端执行
::: code-group

```sh [GitHub]
# （国外推荐）使用 GitHub
git clone --depth=1 https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```

```sh [Gitee]
# （国内推荐）使用 Gitee
git clone --depth=1 https://gitee.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```

```sh [Ghproxy]
# （国内推荐）使用 Ghproxy 代理 Github
git clone --depth=1 https://mirror.ghproxy.com/https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```

:::

::: details 如果你想在 [`Karin`](https://github.com/KarinJS/Karin) 安装

Karin 框架 文档: https://karinjs.github.io/Karin<br>
Karin 务必使用以下的命令安装，否则插件可能不会被识别

::: code-group

```sh [GitHub]
# （国外推荐）使用 GitHub
git clone --depth=1 https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/karin-plugin-kkkkkk-10086/
```

```sh [Gitee]
# （国内推荐）使用 Gitee
git clone --depth=1 https://gitee.com/ikenxuan/kkkkkk-10086.git ./plugins/karin-plugin-kkkkkk-10086/
```

```sh [Ghproxy]
# （国内推荐）使用 Ghproxy 代理 Github
git clone --depth=1 https://mirror.ghproxy.com/https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/karin-plugin-kkkkkk-10086/
```
:::

### 使用 Release 发行版（不推荐）
**_不推荐该方式，后续无法通过 Git 进行更新_**<br><br>
- 打开 Release 页面: https://github.com/ikenxuan/kkkkkk-10086/releases
- 找到最新的版本，下载后缀名为 `.zip` 的压缩包
- 在 `机器人根目录/plugins/` 中解压该压缩包
- 完成后插件应在 `机器人根目录/plugins/kkkkkk-10086/`<br>[Karin](#获取源码) 则为 `机器人目录/plugins/karin-plugin-kkkkkk-10086/`


你可以在此处查看发布过的所有版本: [**版本历史**](../other/timeline.md)


## 安装依赖

移动到插件目录

```sh
cd plugins/kkkkkk-10086/
```

自选一个包管理器安装依赖
::: code-group

```sh [npm]
npm install --production
```

```sh [pnpm]
pnpm install -P
```

```sh [yarn]
yarn --production
```

:::
