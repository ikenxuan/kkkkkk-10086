# kkkkkk-10086 正在小重构中
一个[Yunzai-Bot (V3)](https://github.com/yoimiya-kokomi/Miao-Yunzai)的自用辅助插件
###### 没骗你，真没学过js

## 安装
### Yunzai-Bot或Miao-Yunzai目录下执行：
#### 使用 Gitee
```
git clone --depth=1 https://gitee.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```
#### 使用 GitHub（可能更新不及时）
```
git clone --depth=1 https://github.com/ikenxuan/kkkkkk-10086.git ./plugins/kkkkkk-10086/
```

## 功能(其实就两个)
### 语音盒
<details>
  <summary>语音盒</summary>

鸡音盒

丁真盒

鸡汤盒

耀阳盒

神鹰盒
</details>

为了缩小项目体积，占用资源的东西就不打包进去了
使用`#kkk下载/升级资源`下载或升级所有歌曲资源，大多都是坤坤和丁真的(如果有需要)

### 小红书(需要Tik Hub鉴权token)、快手、douyin作品解析功能
快手解析部分基于官方API

#### douyin解析提供了一个在线接口，开源于 ☞ [Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)
此项目接口可直接下载抖音官方签名好的视频文件，无损画质
使用[在线](https://api.douyin.wtf/docs#/Douyin/get_douyin_video_data_douyin_video_data__get)接口请求可能遇到网络错误，有能力建议自行[本地部署](https://github.com/Evil0ctal/Douyin_TikTok_Download_API#%E9%83%A8%E7%BD%B2%E6%96%B9%E5%BC%8F%E4%B8%80-linux)或者用作者的(锅巴配置写了)
#### 若使用TikHub API功能需先注册[TikHub](https://api.tikhub.io/#/Authorization/register_user_users_register__post)账号 (注意消耗次数)
* 建议使用[锅巴后台](https://gitee.com/guoba-yunzai/guoba-plugin)添加账号密码修改配置文件或 手动修改

配置文件地址：

`/plugins/kkkkkk-10086/config/config.json

目前已经实现可自动通过账号密码获取Tik Hub鉴权token

## 免责声明

1. 图片与其他素材均来自于网络，仅供交流学习使用，如有侵权请联系，会立即删除
2. 功能仅限内部交流与小范围使用，请勿将Yunzai-Bot及kkkkkk-10086用于以盈利为目的的场景

## 友情链接
* Yunzai-Bot (V3): [☞GitHub](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [☞Gitee](https://gitee.com/yoimiya-kokomi/Miao-Yunzai)
* Yunzai-Bot插件库 [☞Github](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [☞Gitee](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index)