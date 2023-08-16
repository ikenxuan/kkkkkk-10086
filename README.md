# kkkkkk-10086（develop）
一个[Yunzai-Bot (V3)](https://github.com/yoimiya-kokomi/Miao-Yunzai)的自用辅助插件
###### 没骗你，真没学过js，全靠cv

## 安装
### Yunzai-Bot或Miao-Yunzai跟目录下打开 CMD 执行：
使用 Gitee
```sh
git clone --depth=1 https://gitee.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```
使用 GitHub
```sh
git clone --depth=1 https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```
使用ghproxy代理加速
```sh
git clone --depth=1 https://ghproxy.com/https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```

## 功能(其实就两个)

### 作品解析(抖音快手)

**快手**解析部分基于官方API（暂停维护）

**抖音**解析提供了一个在线接口，[在这](https://github.com/bxiaoj/video-parser)

### 语音盒

<details>
  <summary>语音盒</summary>

鸡音盒

丁真盒

鸡汤盒

耀阳盒

神鹰盒
</details>

为了缩小体积，占用资源文件不会打包进此项目
使用`#kkk下载/升级资源`下载或升级所有歌曲资源，大多都是我家鸽鸽和丁真的(如果有需要)



## 命令
- #?(语音盒|鸡音盒|丁真盒|鸡汤盒|耀阳盒|神鹰盒)
---
- #?kkk设置
- #kkk设置语音盒(开启|关闭)
- #kkk设置视频解析(开启|关闭)
- #kkk设置默认视频解析(开启|关闭)
- #kkk设置缓存删除(开启|关闭)

### 建议使用[锅巴后台](https://gitee.com/guoba-yunzai/guoba-plugin)修改配置文件或 手动修改(不建议)

配置文件路径：
```sh
# 初次使用自动创建
/plugins/kkkkkk-10086/config/config.json
```

## 常见问题
### 数据获取失败
程序会在控制台打印数据获取情况
```js
data {
  VideoData: {
    code: 200,
    msg: 'success',
    request_id: '20230816230149545rOk3Y4ks',
    data: { aweme_detail: [Object], log_pb: [Object], status_code: 0 },
    is_mp4: true
  },
  CommentsData: {
    code: 'ECONNABORTED',
    message: 'timeout of 5000ms exceeded',
    data: null
  }
}
```
状态码说明: 
```js
200: 请求成功,
403: 配置文件对应配置项为关闭状态
ECONNABORTED: 请求超时未响应,
ERR_BAD_RESPONSE: 服务器无法处理请求,
```
## TODO
- [ ] 个人主页数据解析
- [x] 直播间、抖音作品评论
- [ ] 其他平台作品解析（咕咕咕）
- [ ] 重构

## 鸣谢

- https://gitee.com/xfdown/xiaofei-plugin

- https://github.com/ikechan8370/chatgpt-plugin

- https://github.com/bxiaoj/video-parser

## 友情链接

* Yunzai-Bot (V3): [☞GitHub](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [☞Gitee](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
* Yunzai-Bot插件库 [☞Github](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [☞Gitee](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index)
