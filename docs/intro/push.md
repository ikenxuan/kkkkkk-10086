# 推送功能

该功能为定时任务，默认每 10 分钟执行一次推送（可自定义推送间隔）

## 命令

|      | 抖音                           | B 站                    |
| ---- | ------------------------------ | ----------------------- |
|      | `#设置抖音推送 + 抖音号`       | `#设置B站推送 + UID`    |
| 例子 | `#设置抖音推送yuanshen_mihoyo` | `#设置B站推送401742377` |

::: tip 说明
在发送一次 `相同的命令` 即可取消在当前群的推送
:::

## 样式

::: warning 警告
以下内容可能具有时效性
::: details #kkk 推送列表
![](../../public/intro/pushlist.jpg)
:::

## TODO

- [x] 往后可能会根据配置文件内容进行内容渲染，而不是通过数据库缓存<br>由 [**@ikenxuan**](https://github.com/ikenxuan) 在 [**95dcffa**](https://github.com/ikenxuan/kkkkkk-10086/commit/95dcffab00f8afc1484a1e350911636b2d92006d) 完成
