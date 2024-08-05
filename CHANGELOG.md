# Changelog

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
