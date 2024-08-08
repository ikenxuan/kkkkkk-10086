# Changelog

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
