# Changelog

## [1.7.2](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.7.1...v1.7.2) (2025-04-21)


### Bug Fixes

* **bilibili:** B站没有bvid的错误 ([8f9ae79](https://github.com/ikenxuan/kkkkkk-10086/commit/8f9ae793aef573bf943b18c3ee6b9681e904aa98))
* **Douyin:** 修复抖音解析md无法发送语音 ([#78](https://github.com/ikenxuan/kkkkkk-10086/issues/78)) ([303608f](https://github.com/ikenxuan/kkkkkk-10086/commit/303608f426a188c28877719ca9b3649dab56676c))
* 函数名修正 ([2967f1b](https://github.com/ikenxuan/kkkkkk-10086/commit/2967f1bd16b07eec1c7d5256b3dc2fe8cfaa99d3))
* 回退解析库本地集成。使用npm上的解析库（需更新依赖） ([99094b4](https://github.com/ikenxuan/kkkkkk-10086/commit/99094b4ff2d06cdc9cbbdc89c982ef8df565dae2))
* 评论解析错误 ([b7cdbb5](https://github.com/ikenxuan/kkkkkk-10086/commit/b7cdbb5bd8470c00a1edf871c8ac0cc7b33a4321))

## [1.7.1](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.7.0...v1.7.1) (2025-03-23)


### Bug Fixes

* **bilibili:** 修复B站av号解析 ([#74](https://github.com/ikenxuan/kkkkkk-10086/issues/74)) ([7d39165](https://github.com/ikenxuan/kkkkkk-10086/commit/7d391650ceb840a6b090a63d3c98ccb9ee5d4d3d))

## [1.7.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.6.0...v1.7.0) (2025-01-14)


### Features

* 新增抖音扫码登录 ([2269f55](https://github.com/ikenxuan/kkkkkk-10086/commit/2269f558c4c07a672958b049da7825a1a5117fa6))


### Bug Fixes

* B站风控校验失败 ([384cf65](https://github.com/ikenxuan/kkkkkk-10086/commit/384cf65bd91cdfa688f54631e039d0d9fe4ce7f4))
* close [#65](https://github.com/ikenxuan/kkkkkk-10086/issues/65) ([f097cc6](https://github.com/ikenxuan/kkkkkk-10086/commit/f097cc651616b83d4eca2e5a2616892d722311a0))
* 二维码js ([d895e7a](https://github.com/ikenxuan/kkkkkk-10086/commit/d895e7a9c489642c30df4e3fe43d50621d50de8d))
* 二维码改本地, 推送视频改为发送本地视频 ([02cf730](https://github.com/ikenxuan/kkkkkk-10086/commit/02cf73084123a050210e6445d2bf8b9011fbbc5d))
* 修复获取视频和音频文件大小的逻辑 fix [#71](https://github.com/ikenxuan/kkkkkk-10086/issues/71) ([2407114](https://github.com/ikenxuan/kkkkkk-10086/commit/240711478965fcbb1843bbb0ff171ae8ff5fd022))
* 添加动态卡片信息的空值检查 ([7e1bbdf](https://github.com/ikenxuan/kkkkkk-10086/commit/7e1bbdff6be9e1060e5baa4428cf5a0c39c16906))
* 添加视频下载成功判断以避免空文件发送 ([92ad7fe](https://github.com/ikenxuan/kkkkkk-10086/commit/92ad7fed0a7ec3aa3e443c02d69a9416079259b8))

## [1.6.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.5.0...v1.6.0) (2024-10-04)


### Features

* 抖音B站可获取 x 条评论（无限制） ([95bb86d](https://github.com/ikenxuan/kkkkkk-10086/commit/95bb86de47b172ad6d360c0fdd4660a33f578e65))


### Bug Fixes

* 15秒超时 ([1566cb4](https://github.com/ikenxuan/kkkkkk-10086/commit/1566cb45da51c510454d9a88fa1f4b9ddf74d300))
* 修复B站动态正则表达式，转义特殊字符 ([45c50a6](https://github.com/ikenxuan/kkkkkk-10086/commit/45c50a6d426e2bd5d6fa83761a24e177ab161bf2))
* 修复B站评论内容重复 ([aa2273e](https://github.com/ikenxuan/kkkkkk-10086/commit/aa2273eb792a3814d4b742ed157006a30a9f61b7))
* 修复B站评论表情处理, 更新表情处理函数 ([7d3127b](https://github.com/ikenxuan/kkkkkk-10086/commit/7d3127b89ed98f9e444e312aea2a07a6b49d5438))
* 修复ddos ([c97f42f](https://github.com/ikenxuan/kkkkkk-10086/commit/c97f42f5f280f71d395220c511771b7126f8cc97))
* 修复上游获取数据 ([6bf207f](https://github.com/ikenxuan/kkkkkk-10086/commit/6bf207f1871dcabe1362ab02dc06e9025b6f6a60))
* 修复抖音返回评论为null导致的错误 ([d0f46f2](https://github.com/ikenxuan/kkkkkk-10086/commit/d0f46f2419436e2221a69c42058e61637bdbe4d5))
* 修复视频文件大小限制和B站内容优先的逻辑冲突 ([71eef28](https://github.com/ikenxuan/kkkkkk-10086/commit/71eef284e7705f8650334f9c8fdd5a44d7568339))
* 修复空格转义问题, 修复评论区夜间模式不生效 ([2a9b817](https://github.com/ikenxuan/kkkkkk-10086/commit/2a9b81734fc19873f9f093241a6eb76ad45fef4f))
* 忘了快手 ([aeab2ec](https://github.com/ikenxuan/kkkkkk-10086/commit/aeab2ec46fab27cda0f86f5f18dde0f618392da2))
* 接受200-299，400-499，以及500及以上的状态码 ([43019ef](https://github.com/ikenxuan/kkkkkk-10086/commit/43019ef3cd1f3cfb3eb1557128073b9018cee985))
* 更新上游数据获取 ([b599f32](https://github.com/ikenxuan/kkkkkk-10086/commit/b599f326f669a1c5ca1020512b388ca98fe50794))
* 更新解析库版本 ([7e9e614](https://github.com/ikenxuan/kkkkkk-10086/commit/7e9e61401b4787213b74535af8dba4454d4439f8))
* 移除小红书相关内容 ([25b492e](https://github.com/ikenxuan/kkkkkk-10086/commit/25b492e4010d20002485ec481a668b986fc4f124))
* 补 ([a8701fe](https://github.com/ikenxuan/kkkkkk-10086/commit/a8701fe69305bdf3a66420d105da347cbd715123))


### Performance Improvements

* 优化深色模式 ([67d6846](https://github.com/ikenxuan/kkkkkk-10086/commit/67d68464503e29ae69f03c022ffcc889652ad757))
* 优化深色模式的抖音logo ([f1600c4](https://github.com/ikenxuan/kkkkkk-10086/commit/f1600c422831d6c356cbcec8843e9b2393646e3c))
* 合并空格并自动换行 ([41d8fd0](https://github.com/ikenxuan/kkkkkk-10086/commit/41d8fd04aaf1be7c131f10df1bf835f8076f463f))
* 更新解析库版本 ([bc245ae](https://github.com/ikenxuan/kkkkkk-10086/commit/bc245aeb62afb24e119f9fbccff27213e8884d9f))
* 移除评论转发消息 ([9997d1d](https://github.com/ikenxuan/kkkkkk-10086/commit/9997d1d42164f4d3325f8c682023df09ae903a0e))
* 评论列表增加行间距 ([29f0a1e](https://github.com/ikenxuan/kkkkkk-10086/commit/29f0a1e41b3a99b49b27d4ef11b3430ceca33705))
* 评论图增加深色模式 ([#66](https://github.com/ikenxuan/kkkkkk-10086/issues/66)) ([b11a9b4](https://github.com/ikenxuan/kkkkkk-10086/commit/b11a9b4caf12a14250479f48730bf7160f411fd3))

## [1.5.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.4.1...v1.5.0) (2024-09-12)


### Features

* 抖音推送可选一同发送视频，默认关闭 close [#59](https://github.com/ikenxuan/kkkkkk-10086/issues/59) ([#61](https://github.com/ikenxuan/kkkkkk-10086/issues/61)) ([178bf9b](https://github.com/ikenxuan/kkkkkk-10086/commit/178bf9bfec139eb2f7b5e01bb734a344ec093b4e))


### Bug Fixes

* B站纯文、图文推送图tags替换错误 ([b021892](https://github.com/ikenxuan/kkkkkk-10086/commit/b021892392ab30def3a250795543de3b13ede507))
* B站表情符号渲染错误 ([493fddd](https://github.com/ikenxuan/kkkkkk-10086/commit/493fddd8bf809fc531a5dbac5931c52bc7ec0ba8))
* Github Issue 标签 ([1411399](https://github.com/ikenxuan/kkkkkk-10086/commit/14113997f2d1e82af9830c6e7f36eada4abf83e5))
* icqq引用解析没反应 ([32240f2](https://github.com/ikenxuan/kkkkkk-10086/commit/32240f2eec947aa7fd98352a51243c752e419551))
* long_msg无法引用主动解析 ([9ff6d0e](https://github.com/ikenxuan/kkkkkk-10086/commit/9ff6d0e8b650646c9baae6ebbfef72dcabc6e09c))
* 修复B站链接匹配错误，优化结果获取 ([c692468](https://github.com/ikenxuan/kkkkkk-10086/commit/c692468536245255e1669d6c88ca3457e9c3c972))
* 修复消息数组，循环一次提前break，而拿不到文本消息或者json消息 ([e55b090](https://github.com/ikenxuan/kkkkkk-10086/commit/e55b090e62066b709c05445e3f096600d7f037b3))
* 快手评论模块优化@用户名处理函数，移除冗余console.log ([edeb469](https://github.com/ikenxuan/kkkkkk-10086/commit/edeb46993c9b8aa9ba84b64954435e3c31bca4d3))
* 快手评论模块添加@用户名处理函数，优化展示样式 ([eef4aa0](https://github.com/ikenxuan/kkkkkk-10086/commit/eef4aa07869a89f04c458429cdad076f991f522b))
* 适配` m.bilibili.com` 的 url ([9c97c23](https://github.com/ikenxuan/kkkkkk-10086/commit/9c97c231894d74ee648526eb1f4202975f5a78cd))


### Performance Improvements

* **github-issues:** 更新Issue模板描述 ([b89e8ef](https://github.com/ikenxuan/kkkkkk-10086/commit/b89e8efeef0263f8118a479d8aeb0cbaded6ae11))
* 优化抖音动图视频合成效果 ([5250809](https://github.com/ikenxuan/kkkkkk-10086/commit/5250809d51825ff649042a010c21fb6713189367))
* 加个超时 ([092d2b5](https://github.com/ikenxuan/kkkkkk-10086/commit/092d2b5d4f854c7e935330e16013c1bf269aada3))

## [1.4.1](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.4.0...v1.4.1) (2024-09-03)


### Bug Fixes

* 一点点改动 ([a958f61](https://github.com/ikenxuan/kkkkkk-10086/commit/a958f61aa5cf1592474336db5db4a5737d288a57))
* 下载文件用回pipe方法，取消背压机制，使用md5校检下载的文件 ([e7a8a1f](https://github.com/ikenxuan/kkkkkk-10086/commit/e7a8a1fd6baebb0febfcfec49be478a5f2c96b3f))
* 下载文件用回pipe方法，取消背压机制，使用md5校检下载的文件 ([95299ca](https://github.com/ikenxuan/kkkkkk-10086/commit/95299caf961c69880d6d4b98d1ff8e8fe5312134))
* 优化下载流处理，增加背压机制和最终进度显示 ([62cf3b4](https://github.com/ikenxuan/kkkkkk-10086/commit/62cf3b4e309fb7f88714578cf47323b6951c5fd3))
* 修复boom！ ([afb3225](https://github.com/ikenxuan/kkkkkk-10086/commit/afb32256402b9c3867421a85206689f2228aa290))
* 修复boom！ ([4261b6c](https://github.com/ikenxuan/kkkkkk-10086/commit/4261b6c1a163558f266797c2b0f64e17752d2d29))
* 修复回复消息解析逻辑 fix [#46](https://github.com/ikenxuan/kkkkkk-10086/issues/46), fix [#58](https://github.com/ikenxuan/kkkkkk-10086/issues/58) ([f5fa6cd](https://github.com/ikenxuan/kkkkkk-10086/commit/f5fa6cdf0a5d6140e2840ead59542bea295fc980))
* 修复回复消息解析逻辑 fix [#46](https://github.com/ikenxuan/kkkkkk-10086/issues/46), fix [#58](https://github.com/ikenxuan/kkkkkk-10086/issues/58) ([0d2ad80](https://github.com/ikenxuan/kkkkkk-10086/commit/0d2ad802d8d55e550bffb1e7ab8ec88b0d5fc5cb))
* 修复快手小程序识别 ([67086ce](https://github.com/ikenxuan/kkkkkk-10086/commit/67086cebea81253699a869b3fcc802bc4dea102f))
* 修复快手小程序识别 ([0aab3a1](https://github.com/ikenxuan/kkkkkk-10086/commit/0aab3a1d751863c5e7ee3d6ee9663ad685edf76c))
* 修正B站推送正则表达式语法错误 fix #IANW52 ([03fc012](https://github.com/ikenxuan/kkkkkk-10086/commit/03fc012263f8f818ce7b47890d4dd6fec3410122))
* 修正正则表达式语法错误 ([b56f995](https://github.com/ikenxuan/kkkkkk-10086/commit/b56f995365821fb2976b0d90213db9f04552db0d))
* 修正正则表达式语法错误 ([397911f](https://github.com/ikenxuan/kkkkkk-10086/commit/397911f0fdc1bcf4b82867492809fb99268d7213))
* 修正正则表达式语法错误和Bot.js中的导入大小写 ([efae49d](https://github.com/ikenxuan/kkkkkk-10086/commit/efae49d3e485d29684998d2c5f59e54208f6c77b))
* 扩展回复消息解析以支持json类型 fix [#46](https://github.com/ikenxuan/kkkkkk-10086/issues/46) ([71a2406](https://github.com/ikenxuan/kkkkkk-10086/commit/71a2406bbf6f55b10c563ee4c75c40e7f6030b26))
* 扩展回复消息解析以支持json类型 fix [#46](https://github.com/ikenxuan/kkkkkk-10086/issues/46) ([711fc8b](https://github.com/ikenxuan/kkkkkk-10086/commit/711fc8bc091b905fda68e2b1f76bd37b9ed384a0))
* 移除下载文件的MD5校验逻辑 ([dc7124a](https://github.com/ikenxuan/kkkkkk-10086/commit/dc7124afa8158acb97285b272f93475b059ed028))
* 移除下载文件的MD5校验逻辑 ([34ae05c](https://github.com/ikenxuan/kkkkkk-10086/commit/34ae05c69f0a9cc9bf1036237656f144ab64bc82))
* 移除下载文件的MD5校验逻辑 ([4e112f5](https://github.com/ikenxuan/kkkkkk-10086/commit/4e112f5c593d7a4a4838f094c20bc5ca5175428f))
* 移除下载文件的MD5校验逻辑 ([0e1aa9b](https://github.com/ikenxuan/kkkkkk-10086/commit/0e1aa9b9a8103eb90978954fa5a35f245aafc911))
* 优化下载流处理，增加背压机制和最终进度显示 ([62cf3b4](https://github.com/ikenxuan/kkkkkk-10086/commit/62cf3b4e309fb7f88714578cf47323b6951c5fd3))


### Performance Improvements

* B站配置默认优先保画质 ([785d303](https://github.com/ikenxuan/kkkkkk-10086/commit/785d303f45265ed181aabcef9ba0d0efc23dfc5e))
* **github-issues:** 更新Issue模板 ([757c493](https://github.com/ikenxuan/kkkkkk-10086/commit/757c493e66a69a5fd81e81387dd098289b878f3a))
* **github-issues:** 更新Issue模板 ([d5ab38b](https://github.com/ikenxuan/kkkkkk-10086/commit/d5ab38b797f8c338034a360be4d6b6e896974013))
* **github-issues:** 更新Issue模板以支持中文描述 ([093138b](https://github.com/ikenxuan/kkkkkk-10086/commit/093138b3970cbf405f5c7af9e344ba6867514c08))
* icqq引用解析 ([358c62f](https://github.com/ikenxuan/kkkkkk-10086/commit/358c62f5d07307ebc0f539e0cc4cad02e043c048))
* icqq引用解析 ([9e46692](https://github.com/ikenxuan/kkkkkk-10086/commit/9e4669220232138b7d722adf8a749c1d97d7d32c))
* 优化B站推送图 ([7b9edc8](https://github.com/ikenxuan/kkkkkk-10086/commit/7b9edc8753ea78ad5e3a47d8e4963c88cdc1bc30))
* 优化B站推送图 ([ca590d3](https://github.com/ikenxuan/kkkkkk-10086/commit/ca590d3eaedab8dfcc778eac0452eca853e91a53))
* 优化加载 ([ebc9c06](https://github.com/ikenxuan/kkkkkk-10086/commit/ebc9c06befdf2a6320a6e274edc7ea97bf3895bb))
* 优化加载 ([0ffa168](https://github.com/ikenxuan/kkkkkk-10086/commit/0ffa168db2a4a4d01526f886a4a7fd90a8412a45))

## [1.4.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.3.2...v1.4.0) (2024-08-27)


### Features

* B站支解析仅BVID ([8105894](https://github.com/ikenxuan/kkkkkk-10086/commit/8105894b24a9ec93120a234f85cb49f7b463f73f))
* B站视频上传新增保内容或保画质逻辑 #kkk设置B站内容优先开启/关闭 close [#49](https://github.com/ikenxuan/kkkkkk-10086/issues/49) ([68d68b9](https://github.com/ikenxuan/kkkkkk-10086/commit/68d68b956d221ea58c9ef3fd32121b95f8d690e9))
* 增加下载超时和重试机制，优化下载进度显示 ([cae2eda](https://github.com/ikenxuan/kkkkkk-10086/commit/cae2eda5dc16a012ccc5ddbb9bf96ca09a52a07d))
* 增加分片截图逻辑 ([954163e](https://github.com/ikenxuan/kkkkkk-10086/commit/954163ef4025a45be4dcb6e46f12294c2e96bd8b))
* 支持引用链接解析 ([8b47cab](https://github.com/ikenxuan/kkkkkk-10086/commit/8b47cab5d89e38dc05b444e39fbb1270d24c64e4))
* 新增前缀解析 [#46](https://github.com/ikenxuan/kkkkkk-10086/issues/46) ([#53](https://github.com/ikenxuan/kkkkkk-10086/issues/53)) ([cfee292](https://github.com/ikenxuan/kkkkkk-10086/commit/cfee292f48bdc19f8a21af6cd2ac0f18fc2810d8))
* 新增前缀解析 fixes [#46](https://github.com/ikenxuan/kkkkkk-10086/issues/46) ([#53](https://github.com/ikenxuan/kkkkkk-10086/issues/53)) ([44516c5](https://github.com/ikenxuan/kkkkkk-10086/commit/44516c58d71f7f5694e9471ec108f9b8984f80b2))
* 新增抖音直播链接解析 ([626c07d](https://github.com/ikenxuan/kkkkkk-10086/commit/626c07d891078a3b949f02b9720ac2586082cd25))


### Bug Fixes

* B站图文动态推送使用分片截图 ([c626367](https://github.com/ikenxuan/kkkkkk-10086/commit/c626367fd769832f258a0ae418e7b0dfaf3dfa24))
* B站视频动态二维码错误 ([9fe9880](https://github.com/ikenxuan/kkkkkk-10086/commit/9fe988040c58ad7aa3cc9c0c6ae403044a44e3ab))
* **douyin:** 修复图片上传回复中的数组访问错误 ([4f0269f](https://github.com/ikenxuan/kkkkkk-10086/commit/4f0269f25d12d6fa2f3295811813caca66228e80))
* 仅在发送动态视频时删除文件以避免没文件删 ([476c6fb](https://github.com/ikenxuan/kkkkkk-10086/commit/476c6fb2394ac0dad008e44495cab8fed80e2dba))
* 优化B站动态视频发送逻辑，使用Networks模块获取最终视频地址 ([0873fcd](https://github.com/ikenxuan/kkkkkk-10086/commit/0873fcde0121e92f0402d5c63c26af8a6db9f487))
* 优化B站动态视频发送逻辑，使用Networks模块获取最终视频地址 ([5c6accf](https://github.com/ikenxuan/kkkkkk-10086/commit/5c6accfe5b634af6bbe2812f88391826fa10e5a1))
* 优化B站动态视频发送逻辑，使用Networks模块获取最终视频地址 ([27d4640](https://github.com/ikenxuan/kkkkkk-10086/commit/27d464044e5d19e97a46d0bf893336fc976f3d5a))
* 优化B站动态视频发送逻辑，改为发送本地视频 ([25d1e45](https://github.com/ikenxuan/kkkkkk-10086/commit/25d1e45d2cab837b095798366e71acf92d4ca385))
* 优化puppeteer渲染逻辑，支持多页面图片渲染 ([6c44207](https://github.com/ikenxuan/kkkkkk-10086/commit/6c4420726299cbc7c89363c3b666b77575612ce6))
* 优化图片底部版本信息 ([4719a18](https://github.com/ikenxuan/kkkkkk-10086/commit/4719a18285c00bb3906bd8e3580054d5a769c45b))
* 优化视频上传逻辑，根据适配器类型和视频大小决定上传方式 ([b5eb55a](https://github.com/ikenxuan/kkkkkk-10086/commit/b5eb55af4d860e4b64c8b7e779a2bec4f25a70d4))
* 修复B站动态视频下载逻辑，确保视频变量正确初始化 ([f069655](https://github.com/ikenxuan/kkkkkk-10086/commit/f06965560e63bed22a67413b97e4e3ed80e9641f))
* 修复puppeteer多页面截图逻辑错误 ([25e68bf](https://github.com/ikenxuan/kkkkkk-10086/commit/25e68bf886175ee5b8c33c00344c83fff06262df))
* 修复删除文件方法中视频文件路径可能为空的问题 ([421f609](https://github.com/ikenxuan/kkkkkk-10086/commit/421f609b1e2e05b0b704566c87ee216de1b0d253))
* 修正B站动态视频下载条件判断逻辑 ([8c76ef2](https://github.com/ikenxuan/kkkkkk-10086/commit/8c76ef25c047d2058fbf0bc84a55ffa171106ff2))
* 修正删除文件方法函数removeFile ([7507ce4](https://github.com/ikenxuan/kkkkkk-10086/commit/7507ce434526fb8bdaf2305f704baee389af82eb))
* 修正动态视频发送条件判断并改为base64编码 ([ddf4832](https://github.com/ikenxuan/kkkkkk-10086/commit/ddf4832631807a09688c435a09439c8ba44d8c15))
* 全局分片截图 ([#45](https://github.com/ikenxuan/kkkkkk-10086/issues/45)) ([c3ba6a4](https://github.com/ikenxuan/kkkkkk-10086/commit/c3ba6a489d147f5a35a4970915bed19076497723))
* 分页高度12000 ([4fa8448](https://github.com/ikenxuan/kkkkkk-10086/commit/4fa844866ac5c171a8d1d4d76b13e49260b78943))
* 暂时移除`kkk`前缀 ([fb54365](https://github.com/ikenxuan/kkkkkk-10086/commit/fb54365445e5a5ed78cea12a07f2a94a60329869))
* 替换动态视频下载的UUID为时间戳 ([002a298](https://github.com/ikenxuan/kkkkkk-10086/commit/002a298c961702f0a60c8d42a7718f682a97a136))
* 移除puppeteer渲染选项中的多余配置 ([2decbf1](https://github.com/ikenxuan/kkkkkk-10086/commit/2decbf1ec0f5ec10e3517518a4652e45cac933c0))
* 移除多余的右花括号 ([5455a52](https://github.com/ikenxuan/kkkkkk-10086/commit/5455a5292a2a149e2edfc147407ec599adfb48f4))
* 移除无关日志 ([3344755](https://github.com/ikenxuan/kkkkkk-10086/commit/334475526e51ad65e0a2a2bfb9cf52ab8904e2e5))
* 简化Karin适配器名称返回逻辑 ([103680b](https://github.com/ikenxuan/kkkkkk-10086/commit/103680ba39811386bcdce3cc3e5858944230c3a9))


### Performance Improvements

* 版本获取 ([ba201d0](https://github.com/ikenxuan/kkkkkk-10086/commit/ba201d0d935f0a8619af88e7953a1ff28eb77c78))

## [1.3.2](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.3.1...v1.3.2) (2024-08-22)


### Bug Fixes

* 拉格兰优先发送视频 ([bff25c6](https://github.com/ikenxuan/kkkkkk-10086/commit/bff25c68224908958038aa060d501ca691e4a467))

## [1.3.1](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.3.0...v1.3.1) (2024-08-20)


### Bug Fixes

* **dependencies:** 使用本地链接amagi库，需更新依赖 ([#38](https://github.com/ikenxuan/kkkkkk-10086/issues/38)) ([4ea4078](https://github.com/ikenxuan/kkkkkk-10086/commit/4ea4078141097bce1c8600d90758949ac31acde0))
* wbi签名忘记传入ck了 ([9ae7492](https://github.com/ikenxuan/kkkkkk-10086/commit/9ae7492c2c30deb290e9e2e320f141d7fb5e9738))
* 修复ck为空的情况下B站相关功能报错 ([d4d7666](https://github.com/ikenxuan/kkkkkk-10086/commit/d4d7666f0c663667c97e8d801db0527e23acb91d))
* 导入快手评论处理模块错误 ([737af8d](https://github.com/ikenxuan/kkkkkk-10086/commit/737af8d9f1b64f8c168e3c460df845eee3c2617c))
* 快手评论图添加`视频大小`信息 ([794ac38](https://github.com/ikenxuan/kkkkkk-10086/commit/794ac383f382914c22e04556c91b2f9f0218d1ae))

## [1.3.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.2.3...v1.3.0) (2024-08-18)


### Features

* **bilibili,douyin:** 获取相关接口数据由amagi库全程接管 ([87d0839](https://github.com/ikenxuan/kkkkkk-10086/commit/87d08390ea674bd374ef8ffe1a6cad013f819207))
* **douyin:** 使用@karinjs/md-html和qrcode库来创建和简单渲染用户作品列表。 ([96221e7](https://github.com/ikenxuan/kkkkkk-10086/commit/96221e76a23db0d612e2a14e9e97d964a8b6a5f3))


### Bug Fixes

* B站扫码登录格式化字符串 ([176a777](https://github.com/ikenxuan/kkkkkk-10086/commit/176a7776287c3239f16da272cd34deacfe7c83b6))
* 修复Karin发送语音 ([0724745](https://github.com/ikenxuan/kkkkkk-10086/commit/072474543ab47e72f13b6d8fdb26422c07e13099))
* 修复yunzai next发送语音 ([fae0662](https://github.com/ikenxuan/kkkkkk-10086/commit/fae0662b8e486cad5e3feabf6b650e31de1418d9))
* 修复图集无法发送语音 ([f3ca5d6](https://github.com/ikenxuan/kkkkkk-10086/commit/f3ca5d60bff5c40e62c7df9d9be44a57f3b45717))
* 修复载入报错 ([2d69422](https://github.com/ikenxuan/kkkkkk-10086/commit/2d69422716b9dbae340dd85cbc3882dca74ee302))
* 移除自定义模块 ([e6d9e34](https://github.com/ikenxuan/kkkkkk-10086/commit/e6d9e348a00372611c6ad3197830528a8e641545))
* 适配新版yunzai next ([ee837b0](https://github.com/ikenxuan/kkkkkk-10086/commit/ee837b0d5ef1da00cbd597517fd10447aae83bf0))

## [1.2.3](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.2.2...v1.2.3) (2024-08-13)


### Bug Fixes

* **pushlist:** 修复推送列表获取群名错误 ([9f5fa3c](https://github.com/ikenxuan/kkkkkk-10086/commit/9f5fa3c0d1984af38095654fe0828d4dcd83f48e))
* 修复yunzai v4载入报错 ([613a518](https://github.com/ikenxuan/kkkkkk-10086/commit/613a518725ec431dbabd88429fbb726f80ad5bd0))
* 修复评论中艾特用户昵称正则表达式错误 ([8f49b95](https://github.com/ikenxuan/kkkkkk-10086/commit/8f49b95d9db41203bb92637a148cf316c6f3c21d))
* 增加本地api服务日志开关 ([c928581](https://github.com/ikenxuan/kkkkkk-10086/commit/c928581f57c062062c3492bcef2aa9aa21573d28))
* 移除写入配置文件时的换行 ([ddff5eb](https://github.com/ikenxuan/kkkkkk-10086/commit/ddff5ebc2a9d160cd0fe674fe609d044799afdb7))
* 细节优化 ([e4b7b28](https://github.com/ikenxuan/kkkkkk-10086/commit/e4b7b28c7fd4fc2f06f688b66ed5fe0b5c4c67d0))
* 跟进解析库版本，需更新依赖 ([5b8f588](https://github.com/ikenxuan/kkkkkk-10086/commit/5b8f588499399e7eddd09599ca97f1e366d731e4))

## [1.2.2](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.2.1...v1.2.2) (2024-08-08)


### Bug Fixes

* B站评论数量异常 ([d590c8c](https://github.com/ikenxuan/kkkkkk-10086/commit/d590c8c6356915dab914cabb2e2ff0814c292b63))
* eslint ([d590c8c](https://github.com/ikenxuan/kkkkkk-10086/commit/d590c8c6356915dab914cabb2e2ff0814c292b63))
* logger.log ([a239a35](https://github.com/ikenxuan/kkkkkk-10086/commit/a239a35297fc0aaa2656954e0bfa096e655b0f57))
* **package:** 降低sqlite3版本 ([59df939](https://github.com/ikenxuan/kkkkkk-10086/commit/59df939e21db779d256732f5266bc7212061bf40))
* **push:** 跳出switch ([8c3c657](https://github.com/ikenxuan/kkkkkk-10086/commit/8c3c657c3ae50db1f5fd983400e815c3f4106503))
* 载入数据库报错 ([492670c](https://github.com/ikenxuan/kkkkkk-10086/commit/492670cf176e6c1fcb628e896fc2d96b42f3e38d))

## [1.2.1](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.2.0...v1.2.1) (2024-08-06)


### Bug Fixes

* B站推送 ([31c0f2a](https://github.com/ikenxuan/kkkkkk-10086/commit/31c0f2aad5bf4f9d923a4c3b0f118443466bca48))
* B站推送 ([9b0feab](https://github.com/ikenxuan/kkkkkk-10086/commit/9b0feab5d3536e47d5be33a0d84295e4fef0ec44))
* 设置B站推送 ([8ac5cb4](https://github.com/ikenxuan/kkkkkk-10086/commit/8ac5cb411efd8136ce96e0222a2f212129199645))

## [1.2.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.1.2...v1.2.0) (2024-08-06)


### Features

* 使用@ikenxuan/amagi库放出本地api为http服务 ([#31](https://github.com/ikenxuan/kkkkkk-10086/issues/31)) ([61474cd](https://github.com/ikenxuan/kkkkkk-10086/commit/61474cde08d10d9840606054116a211793ec42d9))
* 增加相关配置项 ([67f1dbd](https://github.com/ikenxuan/kkkkkk-10086/commit/67f1dbdfb0b37ebd667e691d9239d79da34ad600))

## [1.1.2](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.1.1...v1.1.2) (2024-08-05)


### Bug Fixes

* **admin:** 增加快手ck的设置 ([edd177d](https://github.com/ikenxuan/kkkkkk-10086/commit/edd177d697ac74c1fff5db1ea999f3a1f9bcf705))
* **dependencies:** update version ([40ea999](https://github.com/ikenxuan/kkkkkk-10086/commit/40ea999f5b5e1264563c3280c1ad94cee6e5455b))
* **guoba.support:** 增加快手CK设置和优化抖音推送配置 ([f85a589](https://github.com/ikenxuan/kkkkkk-10086/commit/f85a589fa20f9221c986e11d539b17ea9833dccd))
* 暂时修复kkk版本 ([bfca282](https://github.com/ikenxuan/kkkkkk-10086/commit/bfca2829f52d161c5bc054c18dbe36c0fbb085c0))
* 跟进@karinjs/md-html包版本，修复kkk版本样式 ([600e913](https://github.com/ikenxuan/kkkkkk-10086/commit/600e9131a1f10fb457ad0a2fbf39620026bcc943))

## [1.1.1](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.1.0...v1.1.1) (2024-08-05)


### Bug Fixes

* 处理HTTP 429状态码的异常情况 ([d21cae2](https://github.com/ikenxuan/kkkkkk-10086/commit/d21cae2c9c756a7380055340cbde33bc5c185c70))

## [1.1.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.0.1...v1.1.0) (2024-08-05)


### Features

* **bilibili:** 新增直播动态支持 ([0526f85](https://github.com/ikenxuan/kkkkkk-10086/commit/0526f85c1de7d0a0b9877863d98c386d077cdae0))

## [1.0.1](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.0.0...v1.0.1) (2024-08-03)


### Bug Fixes

* actions ([86e405a](https://github.com/ikenxuan/kkkkkk-10086/commit/86e405a2bc80a25c7728921192a317f849a12fb3))
* 插件版本号错误 ([50254d8](https://github.com/ikenxuan/kkkkkk-10086/commit/50254d847bdc85e11c2e2c0992bcd80bb51db9e0))

## [1.0.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v0.2.3...v1.0.0) (2024-08-03)


### ⚠ BREAKING CHANGES

* Changed import paths for components and lib. Update dependent files accordingly.

### Features

* **gitignore:** add eslint.config.js and jsconfig.json to .gitignore ([accb74c](https://github.com/ikenxuan/kkkkkk-10086/commit/accb74c40e2614ec4b37547eaac3611ba5b403a0))
* **kuaishou:** add support for setting and retrieving快手评论数量 ([b379497](https://github.com/ikenxuan/kkkkkk-10086/commit/b379497062b4a3be29017635824c8381dbb9f9be))
* 快手支持自定义ck，默认使用游客（随时失效） ([2a8afd9](https://github.com/ikenxuan/kkkkkk-10086/commit/2a8afd9ca06ac29c3d1e4726aa7a59a1e70e37cf))


### Bug Fixes

* **bilibili:** ensure strict equality in API URL construction and add missing comma in comments.js ([951343f](https://github.com/ikenxuan/kkkkkk-10086/commit/951343ff1bbd801b1e412b76db000b8c14c3f783))
* **module:** correct import path for makeForwardMsg in makeForwardMsg.js ([992c61c](https://github.com/ikenxuan/kkkkkk-10086/commit/992c61c0d3c5bb277f3f068f1fffcb9d0b112175))
* **module:** update import paths and correct plugin URLs in public scripts ([da883a6](https://github.com/ikenxuan/kkkkkk-10086/commit/da883a6402490c003f3af5d5c8776de7e9d6b8e4))
* 先暂时移除node-amagi ([9d0422d](https://github.com/ikenxuan/kkkkkk-10086/commit/9d0422dabad8932fbf199cac717ab3241abcff27))
* 发送主动消息传入uin，需重新配置所有推送用户 ([#26](https://github.com/ikenxuan/kkkkkk-10086/issues/26)) ([342f65c](https://github.com/ikenxuan/kkkkkk-10086/commit/342f65ca725b31174c801d9715a1d8d91b1869b4))
* 暂时移除kkk版本命令 ([954d9bc](https://github.com/ikenxuan/kkkkkk-10086/commit/954d9bcbc33a589c4c7219e77240c960041258e4))


### Code Refactoring

* restructure modules and update component imports ([9e9ede1](https://github.com/ikenxuan/kkkkkk-10086/commit/9e9ede1df4d3b7bf8f6a4b4ccac05d7ec96a1c52))
