# 本地视频解析 API 服务
::: warning
**🚧该功能正在开发中，存在各种不稳定性**

版本迭代可能过快
:::

该功能通过配置文件 `app.yaml` 进行管理

```yaml
# 放出API服务（本地部署一个抖音、B站的api服务）
APIServer: true

# API服务端口
APIServerPort: 4567
```

🛰️ API 文档请查看 [**Apifox**](https://amagi.apifox.cn)

## 📦 调用解析包
>💡 npmjs: https://www.npmjs.com/package/@ikenxuan/amagi

安装解析包: `pnpm install @ikenxuan/amagi`

```js
import amagi, { StartClient } from '@ikenxuan/amagi'

// 初始化
const client = await new amagi({
  douyin: '抖音ck',
  bilibili: 'B站ck'
}).initServer(true) // 传入 true 则开启日志

// 启动监听
await StartClient(client, { port: 4567 })
```
