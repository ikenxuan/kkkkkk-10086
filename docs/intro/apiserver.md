# 本地视频解析 API 服务
> [!NOTE] 🚧 该功能正在测试中，存在各种不稳定性
>
> 此功能依赖 [解析库](https://github.com/ikenxuan/amagi) ，~~该库版本正在快速迭代中，你可能需要及时更新插件依赖以确保正常运作~~（已内置）

## 功能介绍
该功能通过本地部署一个 http 的 API 服务。<br>
接口范围为本插件用到的所有 **_抖音_** **_B站_** API。其他平台暂不考虑<br><br>
如果你想增加更多接口，可以给 [解析库 [amagi]](https://github.com/ikenxuan/amagi) 进行贡献，测试成功后将会将相关接口的功能添加到 kkkkkk-10086 插件中

## 配置
该功能通过配置文件 `app.yaml` 进行管理

```yaml
# 本地部署一个抖音、B站的api服务
APIServer: true

# API服务端口
APIServerPort: 4567
```
<br>

🛰️ API 文档请查看 [**Apifox**](https://amagi.apifox.cn)
