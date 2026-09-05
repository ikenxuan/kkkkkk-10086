# Changelog

## [2.42.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.41.0...v2.42.0) (2026-09-05)


### ✨ 新功能

* **bilibili:** opus 正文支持站内图文链接节点 ([109356c](https://github.com/ikenxuan/kkkkkk-10086/commit/109356c61c5792b12dd4dfe7f777578b942c1f92))
* **config:** 解析失败的配置在 #kkk版本 里列出来 ([ba75079](https://github.com/ikenxuan/kkkkkk-10086/commit/ba7507994e42e00ca9aac9d1a1b55af16aaba214))
* **douyin:** 抖音号、原声、限时表情走 amagi 免鉴权接口 ([2403e75](https://github.com/ikenxuan/kkkkkk-10086/commit/2403e75733db8d8507e3a1c1ea34286cb967abbd))
* **douyin:** 视频源不再排除 HDR 档 ([d0ed503](https://github.com/ikenxuan/kkkkkk-10086/commit/d0ed5030017b7af66f84442d11b7f4e939a7b981))
* **live:** 直播间解析补拉流地址转发与 15 秒预览 ([38028f6](https://github.com/ikenxuan/kkkkkk-10086/commit/38028f653c979177d3bb5a6d16c1425ae8c29e07))
* **login:** 登录二维码中心嵌触发者头像 ([0f9ec0b](https://github.com/ikenxuan/kkkkkk-10086/commit/0f9ec0bbbe44a375140fb097b5d478e41a51e277))


### 🐛 Bug 修复

* **bilibili:** h5 与 blanc 直播间链接取得房间号 ([78a5dc5](https://github.com/ikenxuan/kkkkkk-10086/commit/78a5dc51be806652e8d13e6d162d767bf67ae9e1))
* **ci:** lockfile 与 package.json 对齐 ([6915dbc](https://github.com/ikenxuan/kkkkkk-10086/commit/6915dbc325fcb7124fda1c010ae59c0d7f35961f))
* **live:** 转发版式校正，B站补上 M3U8 与各档位 ([c490c31](https://github.com/ikenxuan/kkkkkk-10086/commit/c490c31fe454a4c7821bc8f22326fa9c573cf97a))
* **request:** UA 粘错 header 名时剥掉前缀，并在 -352 建议里点它 ([69b22f2](https://github.com/ikenxuan/kkkkkk-10086/commit/69b22f2948a3f68f32737bc40a5918b9b8fd7df4))


### 📝 文档

* **upstream:** 对齐表跟到 f9932f8d / v2.42.4 ([7c34c44](https://github.com/ikenxuan/kkkkkk-10086/commit/7c34c44a66b2bfcd9c51e4342048bf42de91254b))


### ♻️ 重构

* **amagi:** 删掉枚举兜底副本，统一走 loadAmagiEnums ([3ccd661](https://github.com/ikenxuan/kkkkkk-10086/commit/3ccd661caa11a17718b5d656dd9cd45ad85e0373))
* **render:** 移除隐水印，页脚版本信息强制常显 ([c82e1d9](https://github.com/ikenxuan/kkkkkk-10086/commit/c82e1d9843e012df879f202feba6630e5b6938d9))

## [2.41.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.40.0...v2.41.0) (2026-09-02)


### ✨ 新功能

* **amagi:** 旁路记录 api:error 的真实业务码 ([0e53b07](https://github.com/ikenxuan/kkkkkk-10086/commit/0e53b076cf5660e6ff5db18a07ee50d62ed1cf99))
* **bilibili:** 动态的额外卡片接上载荷 ([bc814d5](https://github.com/ikenxuan/kkkkkk-10086/commit/bc814d5b37343b2f5b31dab3e46c1a9013dbc644))
* **cache:** API 响应加进程内 LRU 分级缓存，诊断卡报并发与缓存 ([8e7b254](https://github.com/ikenxuan/kkkkkk-10086/commit/8e7b2545ec1d5a2b007520f35192b129e1a0391d))
* **diagnostics:** 诊断卡加上解析队列占用 ([0f48a72](https://github.com/ikenxuan/kkkkkk-10086/commit/0f48a72a75edfdfa274fe254218be1b62eee720a))
* **douyin:** 扫码登录改用 amagi passport 接口 ([6d348d8](https://github.com/ikenxuan/kkkkkk-10086/commit/6d348d8c4698940c45309e5cac55416f91971564))
* **douyin:** 视频源改为档位优先、体积其次，并排除 HDR 档 ([7ab99a8](https://github.com/ikenxuan/kkkkkk-10086/commit/7ab99a806993b18d8cf37e8c52fbe16a00daacbe))
* **download:** 低速自动换地址、CDN 地址簿回退与外部下载器 ([b93d2ff](https://github.com/ikenxuan/kkkkkk-10086/commit/b93d2ff359c54bf88bd6e8dc83b72af12c4d8d51))
* **download:** 按平台分桶的连接预算，实况图改滑动窗口下载 ([b069850](https://github.com/ikenxuan/kkkkkk-10086/commit/b069850a367a04658db62c9075948e4880cffe07))
* **ffmpeg:** 新增直播流录制封装 ([79259e0](https://github.com/ikenxuan/kkkkkk-10086/commit/79259e0ee07e1f67f8a294c3aaf7f77f2da2a6ef))
* **live:** #kkk录直播 命令，抖音与B站各录一段上传 ([2aa111d](https://github.com/ikenxuan/kkkkkk-10086/commit/2aa111d555107b3cc49032d8482427dd0a133c46))
* **live:** 抖音与 B 站各提供一个可播直播流地址 ([1f35a3f](https://github.com/ikenxuan/kkkkkk-10086/commit/1f35a3f19e790be22fc4fc6fd6a6140bb1fb44d3))
* **live:** 直播录制的配置项、锅巴面板与时长上限透传 ([c7ad19b](https://github.com/ikenxuan/kkkkkk-10086/commit/c7ad19bd88ebfbf74fe43515ddec3a8372588930))
* **parse:** 全平台解析支线并发执行 ([6a7ab8e](https://github.com/ikenxuan/kkkkkk-10086/commit/6a7ab8edb1733d05fb73ee95195cb0084d0a4d1b))
* **utils:** amagiClient 统一把 amagi 业务失败抛成 AmagiError ([145d6bf](https://github.com/ikenxuan/kkkkkk-10086/commit/145d6bf883e000f0cffab4480a03d6079dba5233))
* **utils:** record.ts 加 at 与 firstUrl 两个安全取值原语 ([ff42bfd](https://github.com/ikenxuan/kkkkkk-10086/commit/ff42bfd6dff1d8f42ee7a9e3f26f88a27be082a4))


### 🐛 Bug 修复

* **apps:** BGM 规则补上开头锚点，不再截走别人的命令 ([992d3ba](https://github.com/ikenxuan/kkkkkk-10086/commit/992d3ba9be7158c229cd144fa8c2e6722984ab40))
* **apps:** 两个 app 的最高优先级判定统一口径 ([343f0ee](https://github.com/ikenxuan/kkkkkk-10086/commit/343f0eed02e2acec679231fa072e8916540c928a))
* **bilibili:** 番剧分支的音轨与画质列表补上普通视频路径已有的守卫 ([6d05d24](https://github.com/ikenxuan/kkkkkk-10086/commit/6d05d247296a21da774ec7af5c487abdef0a3467))
* **bilibili:** 直播 playurl 的 wbi 结论改成实测，fixture 按真机校准 ([490564d](https://github.com/ikenxuan/kkkkkk-10086/commit/490564dd3b04af09391f21a829700bb8d483f82b))
* **bilibili:** 补全裸域名分享链接的协议头，URL 解析失败不再废掉整张模式表 ([497fb43](https://github.com/ikenxuan/kkkkkk-10086/commit/497fb43a225f3f15bdb0e776465cab60ef266099))
* **config:** 配置读取改深拷贝，pushlist 落盘走原子读改写 ([d44fc4d](https://github.com/ikenxuan/kkkkkk-10086/commit/d44fc4df15f74c94b983ee8ef6a31bda3469c6bf))
* **douyin:** adapt 模式下体积上限与上传闸门取更严的那个 ([9c3a869](https://github.com/ikenxuan/kkkkkk-10086/commit/9c3a86915910390e13972ad4e9eb558622c057d3))
* **douyin:** 实况图与推送下载改用签名直链，不再自己拼 snssdk 地址 ([d4b0315](https://github.com/ikenxuan/kkkkkk-10086/commit/d4b03154fe16bbaeb27e05cf55ed41e04b5a3d0a))
* **douyin:** 收紧 bit_rate 与 url_list 声明，修掉由此暴露的裸下标 ([8af2715](https://github.com/ikenxuan/kkkkkk-10086/commit/8af2715cb3705d976ee69821e2f4cc3d0b41927a))
* **douyin:** 评论取数搬进支线闭包，接口挂了不再挡住视频 ([7892352](https://github.com/ikenxuan/kkkkkk-10086/commit/789235281c74ad6d8b6086f83492010d2795534e))
* **douyin:** 评论配图失败不再带走整批评论图 ([8096375](https://github.com/ikenxuan/kkkkkk-10086/commit/80963758542e29a8192523d42df66f554f3c2b74))
* **error:** 指纹构造失败不再静默，B 站关评论区改为明确提示 ([d748dc8](https://github.com/ikenxuan/kkkkkk-10086/commit/d748dc8bda0b8985d3fd3c25b59e2e5fe7b919da))
* **help:** 帮助卡补上 #kkk录直播，并给菜单数据加护栏 ([888b080](https://github.com/ikenxuan/kkkkkk-10086/commit/888b080275f58d0f23114d23908568ae1da4c9fb))
* **help:** 菜单数据搬出 apps/，两条命令恢复可用 ([3583838](https://github.com/ikenxuan/kkkkkk-10086/commit/3583838fdac72d30ea084cd665438e0f3f5f2203))
* **kuaishou:** 评论与表情取数搬进支线，两个闸门真的生效 ([c0c81f0](https://github.com/ikenxuan/kkkkkk-10086/commit/c0c81f0bc44878629c39a831c9b31b017793f1ea))
* **live:** 放行直播间链接并修好房间号解析 ([0437ca2](https://github.com/ikenxuan/kkkkkk-10086/commit/0437ca2d55a285f7ef3a1c63ef7d06152ba236ad))
* **parse:** 外层解析预算从内层支线上限推导，不再被 60s 默认值掐死 ([cb345f3](https://github.com/ikenxuan/kkkkkk-10086/commit/cb345f3661d83d9f665e7c8b0e3b699f412aec51))
* **parse:** 抖音图文与B站动态的正文、图片、评论各自成支线 ([b7ac2ef](https://github.com/ikenxuan/kkkkkk-10086/commit/b7ac2efcc17e608ec57eb4fd5b6f35761bd5db5b))
* **parse:** 超时信号透传到任务闭包，取消不再掉在地上 ([58752d0](https://github.com/ikenxuan/kkkkkk-10086/commit/58752d05482c0bd0146e023d2e9e53d8dcd89697))
* **parse:** 选集类入口补上并发队列与指纹去重 ([498b56e](https://github.com/ikenxuan/kkkkkk-10086/commit/498b56e26a6b37a1cce844965a38ec9420b849e7))
* **platform:** 模块级 mp4size 与 img 收进解析作用域 ([ba2345e](https://github.com/ikenxuan/kkkkkk-10086/commit/ba2345ed1761466a16cd9f7715621669cbeaf6b7))
* **push:** 推送视频路径的 bit_rate 裸下标与日志取长度改成安全取值 ([81824c5](https://github.com/ikenxuan/kkkkkk-10086/commit/81824c5552e83f7444440937f3df3aa3a754d6fd))
* **qqbot:** 引用解析改读 msg_elements ([be45770](https://github.com/ikenxuan/kkkkkk-10086/commit/be4577035e32bf738d395ee5e8ddd006ba8ca66e))
* **render:** 图文封面与图片列表的裸下标换成 at，保住下标偏好顺序 ([38d6887](https://github.com/ikenxuan/kkkkkk-10086/commit/38d6887253d6c59ac07bc0e2767b7a6d2bd497f7))


### 📝 文档

* **comments:** 修正指向已删除 Networks.ts 的注释坐标 ([96ee5aa](https://github.com/ikenxuan/kkkkkk-10086/commit/96ee5aad774fa468a804149f64ed30d44ea040f6))
* upstream-sync 校准到上游 c5512ace（v2.42.3） ([dcd6453](https://github.com/ikenxuan/kkkkkk-10086/commit/dcd645342a42c1354c529c21fb79d58a574e0290))
* upstream-sync 的 -352 一节按 2669ab0d 校准 ([255537a](https://github.com/ikenxuan/kkkkkk-10086/commit/255537a78138a7b0c7b468196436421ce7b22dbb))
* 注释与文档里的失效指针校准 ([a7eb9ad](https://github.com/ikenxuan/kkkkkk-10086/commit/a7eb9ad2a1d2bf787bfd88b503eb24a6408c9bec))
* 落 upstream-sync.md，按平台记上游 sha 与对齐范围 ([490ea11](https://github.com/ikenxuan/kkkkkk-10086/commit/490ea1120c73c1e396b682f50c594ddf2c0d5c4f))
* 记下推送路径空 cookie 这处与上游的语义分叉 ([314f8d5](https://github.com/ikenxuan/kkkkkk-10086/commit/314f8d5bdd9e3c688220218cdd71a17fbc84fd7e))


### ♻️ 重构

* **bilibili:** -352 的 voucher 提取合并成一个共享模块 ([2669ab0](https://github.com/ikenxuan/kkkkkk-10086/commit/2669ab0d265a54b3148f2f6f858bf6b0818a744d))
* **cache:** ApiCache 两张策略表的键换成 amagi 英文 fetcher 名 ([ceb2e78](https://github.com/ikenxuan/kkkkkk-10086/commit/ceb2e78d21d28f52b3d49e630d90702aac1307a8))
* **comments:** 注释清理收尾，49 个小文件 ([6e155fc](https://github.com/ikenxuan/kkkkkk-10086/commit/6e155fc54f74b0250283203e44cb51ab6fc62dab))
* **comments:** 清掉 11 个大文件里的复述式注释与死 JSDoc ([23b1d29](https://github.com/ikenxuan/kkkkkk-10086/commit/23b1d29a726f0f45429791675e24af03b1fd0d55))
* **comments:** 清掉 19 个文件里的复述式注释，并找回被误删的类型注释 ([c1a25e3](https://github.com/ikenxuan/kkkkkk-10086/commit/c1a25e366829c39692e26dcf29310ccf2689ecea))
* **comments:** 清掉 20 个高密度文件里的复述式注释 ([6dd1f27](https://github.com/ikenxuan/kkkkkk-10086/commit/6dd1f27d7531db945f105a9f708b28fb311040a7))
* **comments:** 清掉最后 21 个文件里的复述式注释 ([36b414e](https://github.com/ikenxuan/kkkkkk-10086/commit/36b414ed595067c61e5b17fd714c4e27bf717478))
* **config:** 删掉三个失去作用面的配置项 ([5361b33](https://github.com/ikenxuan/kkkkkk-10086/commit/5361b33e1538cf13c469d6e6f2a00ab0bd52b0c8))
* **error:** 错误卡片收成一个出口 ([ef51bf7](https://github.com/ikenxuan/kkkkkk-10086/commit/ef51bf7c7a4e010c03efcc7b425c014ccf0fcac7))
* **guoba:** 面板支持迁到 src/module/guoba/index.ts ([c5f7b06](https://github.com/ikenxuan/kkkkkk-10086/commit/c5f7b06a6c3d598d3fb125f2442b8b225cab1023))
* **kuaishou:** 取数迁到 amagi，并补上软错误码设施 ([370fa60](https://github.com/ikenxuan/kkkkkk-10086/commit/370fa608f887cb90cdf49fcce3aa0dd0094359f4))
* **network:** attemptDownloadStream 拆入 download-pipeline ([24007e5](https://github.com/ikenxuan/kkkkkk-10086/commit/24007e584f9f8426cda76742b43dd968ef1a5265))
* **network:** Networks 收成薄客户端并加 barrel ([c34b1ab](https://github.com/ikenxuan/kkkkkk-10086/commit/c34b1ab7a51143cf32670cd5a97a14dd0f9cd866))
* **network:** 内建下载改走实例 axios ([bfe7bd4](https://github.com/ikenxuan/kkkkkk-10086/commit/bfe7bd4dff0cebd6562987f8654f66aa62ba9484))
* **network:** 删掉死函数 getfetch 与重复的直播上限默认值 ([23a06b3](https://github.com/ikenxuan/kkkkkk-10086/commit/23a06b324e129b7f9fee9bdcd66420f95b835f4f))
* **network:** 抽出 download-options 与 retry-plan ([cc31c12](https://github.com/ikenxuan/kkkkkk-10086/commit/cc31c12fa1339f579133c421d45c12350571eb44))
* **network:** 抽出五个叶子模块 ([e650276](https://github.com/ikenxuan/kkkkkk-10086/commit/e650276682ffdaea21fafdbd6bd0f5e46150c1ca))
* **network:** 新建 Network/ 目录并移入六个已独立的下载模块 ([d8fc69e](https://github.com/ikenxuan/kkkkkk-10086/commit/d8fc69e8d7df4152693ec904afb2eeed1a931e52))
* **platform:** 删掉四个 api.ts，调用点直连 amagi fetcher ([3be5556](https://github.com/ikenxuan/kkkkkk-10086/commit/3be555692fb16b6d77f0bad8b0e2e4529228343a))
* **template:** kkk 矢量图抽成共享组件 ([16be75f](https://github.com/ikenxuan/kkkkkk-10086/commit/16be75fe731febb0853564c1f7f166e17604ba48))
* **types:** DecorationCardData 在 ktr 侧转发一次，保住上游镜像可比性 ([a563436](https://github.com/ikenxuan/kkkkkk-10086/commit/a563436160870a6f9149df1090d7c4e19dbd674a))
* **types:** 两份手抄的模板契约副本合成单一声明 ([8e55b7e](https://github.com/ikenxuan/kkkkkk-10086/commit/8e55b7ef4b1f1c9ae5d0dec500f3a0c692d20c7d))
* **types:** 四个新 types.ts 从 barrel 转发，跟既有约定统一 ([1984307](https://github.com/ikenxuan/kkkkkk-10086/commit/1984307a980517e6b5dcf40f3e61865ba536f432))
* **types:** 四个目录的跨文件类型声明收进各自 types.ts ([0e41ce0](https://github.com/ikenxuan/kkkkkk-10086/commit/0e41ce01ef28cc572bfc878702ae634dc0b8e960))
* **types:** 类型声明抽到各目录的 types.ts ([319d6d5](https://github.com/ikenxuan/kkkkkk-10086/commit/319d6d54e8be643182dade48e1a03fe17c4668be))
* **upload:** 移除按适配器分档的群文件强制判定 ([522ab6a](https://github.com/ikenxuan/kkkkkk-10086/commit/522ab6aff020a1cbd2a6ad68f056a511e52176ce))
* **utils:** 主人告警通道独立成 masterMessage 模块 ([392e557](https://github.com/ikenxuan/kkkkkk-10086/commit/392e557efce39e9ec598e28ca8ccd85dbbf80f9a))


### ✅ 测试

* **bilibili:** 钉住 amagi 枚举与手写兜底副本的对应关系 ([84962cb](https://github.com/ikenxuan/kkkkkk-10086/commit/84962cbcf9099519c8344c10addd5d6b38ee380d))
* **bilibili:** 钉住每个取数调用点实际传出去的 cookie ([91f830e](https://github.com/ikenxuan/kkkkkk-10086/commit/91f830e9436c7300898c1e29eb8a116ff96034ce))
* **douyin:** 钉住兜底地址的主机，不跟上游 4772801 换成 https://c/ ([3095a6d](https://github.com/ikenxuan/kkkkkk-10086/commit/3095a6d6d6578b86c9a5c0f003e50b56c2519438))
* **render:** 运行时报告 fixture 补上 concurrency 字段 ([edf401f](https://github.com/ikenxuan/kkkkkk-10086/commit/edf401f05786a61966863e11ad325632a0b53130))
* **render:** 运行时报告 fixture 补上 parse 字段并钉住契约类型 ([f8fe370](https://github.com/ikenxuan/kkkkkk-10086/commit/f8fe370244e8649879a625fa3bd75ac7741f2a23))

## [2.40.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.39.3...v2.40.0) (2026-08-26)


### ✨ 新功能

* **dev:** 补运行诊断/错误卡/群统计三个模板的开发面板 mock ([50d2e8b](https://github.com/ikenxuan/kkkkkk-10086/commit/50d2e8b4a616230d82565ccd27423332d6d2ae8b))


### 🐛 Bug 修复

* **card:** 协议标准出字修正，并补上 QQBot 的通信方式探测 ([ffed104](https://github.com/ikenxuan/kkkkkk-10086/commit/ffed104798ad4615a0f2b0615768311e9e2ebff2))
* **ci:** 欢迎流程改用 listForRepo 判定首次提 issue ([9ea1fa3](https://github.com/ikenxuan/kkkkkk-10086/commit/9ea1fa3fd56cd17f87bb51214dc55d2f4acc94af))
* **dev:** 开发面板 host 钉成 IPv4，localhost 解析到 ::1 导致打不开 ([77e7636](https://github.com/ikenxuan/kkkkkk-10086/commit/77e7636c485e2924510363a95f20950378912809))
* **push:** 主动推送的错误卡片补上目标群号和适配器信息 ([2c06ef3](https://github.com/ikenxuan/kkkkkk-10086/commit/2c06ef35a65ffd507d4f8a972b2ced5ba1d69444))


### 🤖 CI/CD 配置

* **issue:** 相似度分析换成 github-script 自实现 ([80d094d](https://github.com/ikenxuan/kkkkkk-10086/commit/80d094da9fabf2a7fd34b10a78d0578f54fd340b))
* node-version 改用 lts/* 别名，不再钉死大版本 ([5314227](https://github.com/ikenxuan/kkkkkk-10086/commit/53142275965c75d580e46f964e56d06c80d6304e))

## [2.39.3](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.39.2...v2.39.3) (2026-08-25)


### 🐛 Bug 修复

* **ci:** issue 自动回复换用官方 github-script，原 action 已被封禁 ([8d82c21](https://github.com/ikenxuan/kkkkkk-10086/commit/8d82c21fdf1fcc0d50670646857d7dcd92baf0a1))

## [2.39.2](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.39.1...v2.39.2) (2026-08-25)


### ✅ 测试

* **ci:** workflow 契约跟上 Node 24 与新 action 版本 ([59da304](https://github.com/ikenxuan/kkkkkk-10086/commit/59da304280f1a6b00272ebac4d4750a7a2eccff5))
* **db:** 保留期用例改批量插入，CI 上不再超时 ([83603a4](https://github.com/ikenxuan/kkkkkk-10086/commit/83603a4d22b184045de169ae419e9c10915411fb))


### 🤖 CI/CD 配置

* Node 版本钉到 24，action 升到自身跑 node24 的版本 ([73b41ee](https://github.com/ikenxuan/kkkkkk-10086/commit/73b41ee3d670e6f530345b82029b8cf5ea840535))

## [2.39.1](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.39.0...v2.39.1) (2026-08-25)


### 🐛 Bug 修复

* **adapter:** 适配器名取协议端真名，协议实现不再显示成平台名 ([b79ef3e](https://github.com/ikenxuan/kkkkkk-10086/commit/b79ef3e64eeca175aacbf7ded01c9e0214570235))
* **bilibili:** ck 失效时改走 dash 兜底，不再误报「请配置CooKie后重试」 ([84c5917](https://github.com/ikenxuan/kkkkkk-10086/commit/84c591701eb62bacf415b07e9f54f19ce51ce07b))
* **bilibili:** 风控验证失败按错误码给提示，并改出错误卡片 ([91024ef](https://github.com/ikenxuan/kkkkkk-10086/commit/91024efe99db1d1bc3ce9aec62ce0bd8807a7260))
* **config:** cookie 归一成字符串，写入失败不再谎报保存成功 ([59b09c8](https://github.com/ikenxuan/kkkkkk-10086/commit/59b09c81a2bf6652460e7099a2369956373e7061))
* **db:** 去重键按目标保留最新若干条，长播场次不再被清掉重推 ([e1c6145](https://github.com/ikenxuan/kkkkkk-10086/commit/e1c6145dd943ce853a16f6b2d110f1bed908692a))
* **douyin,xiaohongshu:** 同步上游修过的取值与守卫 ([df51410](https://github.com/ikenxuan/kkkkkk-10086/commit/df514105ea86f7710e959d912f73f67fc0afb2f2))
* **error:** 卡片发到触发者后不再补发同一条错误的文字 ([6001aaa](https://github.com/ikenxuan/kkkkkk-10086/commit/6001aaa01fa2042488608bf5cb53af6a5cbab537))
* **push:** 发送失败不再记已推，避免那条内容永久漏发 ([36fe326](https://github.com/ikenxuan/kkkkkk-10086/commit/36fe326f0a61bc2495c8b42f2b1e0cc8f961c368))
* **template:** 排行图的名字改换行，不再被切掉半个字 ([ca7a280](https://github.com/ikenxuan/kkkkkk-10086/commit/ca7a2802d714e5cb922d393dc6f57abee9e6eb73))


### 📝 文档

* 修正产物推送目标分支，实际是 master 不是 release ([f3a6fef](https://github.com/ikenxuan/kkkkkk-10086/commit/f3a6fef4b5351c656875ec77faa0ad8c40a63d55))


### ♻️ 重构

* **types:** 删掉 camelCase 事件字段的兼容分支 ([8c51cd5](https://github.com/ikenxuan/kkkkkk-10086/commit/8c51cd59c6374559dfd12e26d3ca17c1bf7d4652))
* **utils:** 23 份 isRecord 并成一份，统一取排除数组的严格语义 ([3c02fc3](https://github.com/ikenxuan/kkkkkk-10086/commit/3c02fc31b4687d43c8bd46940e3ec903bdf0489a))
* **utils:** 3 份 escapeHtml 并成一份 ([afb9bd7](https://github.com/ikenxuan/kkkkkk-10086/commit/afb9bd7d64dcbee38cd33029a85a0c9a7da39df7))


### ✅ 测试

* **tooling:** 把「二进制按路径直调」这个不变量钉进契约 ([780b82d](https://github.com/ikenxuan/kkkkkk-10086/commit/780b82dbbb64477f1a381b2ca8ae223909b54431))
* 集成测试超时从默认 5s 放宽到 30s ([594d810](https://github.com/ikenxuan/kkkkkk-10086/commit/594d810b8f76cdcaa9e9188184e9c77894e9d758))


### 🤖 CI/CD 配置

* ci.yml 改名 check.yml，让侧边栏读到中文 workflow 名 ([eedd94b](https://github.com/ikenxuan/kkkkkk-10086/commit/eedd94b8eb8687955214225c3b7ef2884eafe151))
* **release:** master 的产物提交信息带上 tag / 版本 / 源提交 ([810cefd](https://github.com/ikenxuan/kkkkkk-10086/commit/810cefd556592ec9979e9dcf7ff299c6b7abf53a))

## [2.39.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.38.4...v2.39.0) (2026-08-23)


### ✨ 新功能

* **statistics:** 单群统计卡加本群用户解析排行 ([964291b](https://github.com/ikenxuan/kkkkkk-10086/commit/964291b62a30fc63018dac470efb26d45e90c5d8))
* **statistics:** 解析统计加上媒体时长/体积/耗时 ([f4d5650](https://github.com/ikenxuan/kkkkkk-10086/commit/f4d56508f1ff44246db9b9143b1fe416dacb0320))
* **tooling:** 加开发面板入口 template:dev，支持捕获真实渲染数据 ([044139e](https://github.com/ikenxuan/kkkkkk-10086/commit/044139edbf9bcad8d520fdcf8eb7e8be088ea296))
* **upload:** 视频发送体积上限从 100MB 提到 1536MB（1.5GB） ([595d9c1](https://github.com/ikenxuan/kkkkkk-10086/commit/595d9c16858e0dbb696d346e649a6162b4db226c))


### 🐛 Bug 修复

* **bilibili:** 实况图推送把临时文件清理挪到发送之后 ([97e1cbd](https://github.com/ikenxuan/kkkkkk-10086/commit/97e1cbdb11fbe00ddf8371416787fb607e290beb))
* **comment:** 抖音/B站评论数量改读新键 numcomment，旧键仅作兜底 ([bee4334](https://github.com/ikenxuan/kkkkkk-10086/commit/bee4334475d30273e7c9fcf5fc6d34666c150e32))
* **db:** 修正两处类型与实际读取不符 ([1529b27](https://github.com/ikenxuan/kkkkkk-10086/commit/1529b27653c767261d144e5c86dcdf7a3d2a3821))
* **error:** 错误卡片按 Bot 取主人，不再发到 QQBot 的 QQ 号上 ([7c728a0](https://github.com/ikenxuan/kkkkkk-10086/commit/7c728a041356976f9165af8e1cf75b8e39090ed2))
* **render:** 成图四角改回透明，纯黑背景下不再亮一块 ([88330bf](https://github.com/ikenxuan/kkkkkk-10086/commit/88330bf3f1eb18613a78c6e07739f7991f0851c9))
* **scripts:** npm scripts 改按路径直调本地二进制，不再依赖 .bin shim ([5e98a56](https://github.com/ikenxuan/kkkkkk-10086/commit/5e98a563e66e449dc50d58feb6ae33c4d6244564))
* **security:** ffmpeg/ffprobe 改 execFile + 参数数组，命令不再过 shell ([9dc2440](https://github.com/ikenxuan/kkkkkk-10086/commit/9dc2440933f88fdd5424cd4ddb9102c36f5e19cd))
* **security:** 文件名清洗统一封口，剔掉 shell 元字符 ([49120c2](https://github.com/ikenxuan/kkkkkk-10086/commit/49120c21a0d3a252801ca9d1416901b1517f9b01))
* **statistics:** 全局统计按群号查群名，排行不再算私聊 ([0da60cd](https://github.com/ikenxuan/kkkkkk-10086/commit/0da60cd33b3469ba67118b320c2fc6f24082e36b))
* **template:** 全局统计环形图不再给零值平台画标签 ([d4ac049](https://github.com/ikenxuan/kkkkkk-10086/commit/d4ac049858a4a40c76ec25db1c435b74ad04c71c))
* **template:** 标签行再右移，和左上角装饰点阵拉开距离 ([0f06a71](https://github.com/ikenxuan/kkkkkk-10086/commit/0f06a71d0ff83d76b38711f5ed15a9787605ff3c))
* **template:** 统计卡片标签行让开左上角装饰点阵 ([e9161b2](https://github.com/ikenxuan/kkkkkk-10086/commit/e9161b292c018519c9b71ccecc6bf42f6f9254aa))
* **template:** 群组统计的标签行也跟上 pl-16 ([f8b2667](https://github.com/ikenxuan/kkkkkk-10086/commit/f8b26675d0196ce78fd838f9bba0a8f032556c51))
* **template:** 页脚插件名缩到 33px，commit hash 不再跟通道走色 ([731d4ba](https://github.com/ikenxuan/kkkkkk-10086/commit/731d4ba77b69bae14540cb9fcff46b812fda52b2))
* **tooling:** 模板构建直调 ktr 入口，不再依赖 .bin shim ([5d57025](https://github.com/ikenxuan/kkkkkk-10086/commit/5d570253996e6355f870ae35e10e1311a0423abc))
* **upload:** useGroupFile 入参不再被配置覆盖，1536MB 上限真正可达 ([3a79d85](https://github.com/ikenxuan/kkkkkk-10086/commit/3a79d8518fbdd3be2cef66c53df8fb1f9704daac))
* **upload:** 群文件接口缺失时如实报失败，不再假装发送成功 ([85eccd8](https://github.com/ikenxuan/kkkkkk-10086/commit/85eccd89b44762acea21092fecb8788cc7152f47))
* **upload:** 远程URL直发先按体积判断，探不到体积不阻塞发送 ([210abcb](https://github.com/ikenxuan/kkkkkk-10086/commit/210abcb05ee11a3971088e4c77cba3101a3689f0))
* **utils:** exec 的错误日志丢掉了 code/syscall，只剩一句 message ([701fe34](https://github.com/ikenxuan/kkkkkk-10086/commit/701fe34b55872f4230c5ba2160be975f37807fe5))
* **utils:** 修四处审查查出的真缺陷 ([98eadb0](https://github.com/ikenxuan/kkkkkk-10086/commit/98eadb08c7d05a62191a1fa9a7247584602ecbd7))


### 📝 文档

* **ktr:** ktr/ 镜像的注释与上游对齐，零行为变更 ([99ee232](https://github.com/ikenxuan/kkkkkk-10086/commit/99ee23257dcc98990291c36056bbb495eb4f2f50))
* **security:** 两处注释还在说 ffmpeg 命令过 shell，已经不是了 ([e403e88](https://github.com/ikenxuan/kkkkkk-10086/commit/e403e88d5c59838ac95586d6fc430e62dcdd5e73))


### ♻️ 重构

* **bilibili:** 删掉与 richtext 核心逐字段重复的 26 个平行类型 ([994e6e5](https://github.com/ikenxuan/kkkkkk-10086/commit/994e6e5ec0800aa0bab8f5a7eae0827b216ccbf0))
* **guoba:** 面板 schema 按分组拆到 src/module/guoba/，入口只留拼装 ([72afae7](https://github.com/ikenxuan/kkkkkk-10086/commit/72afae7778f90af6526598b2ecdcfff7c27f6015))
* **richtext:** linkCard.meta 的 any 收成 unknown ([03820b5](https://github.com/ikenxuan/kkkkkk-10086/commit/03820b59a2f1dc9b6ae168803748f97d428f4a3b))
* **utils:** 19 处手写的 instanceof Error 三元式换成共享 getErrorMessage ([58ff348](https://github.com/ikenxuan/kkkkkk-10086/commit/58ff3480afe497f75e50f92eb818e04566de8909))
* **utils:** 6 份 getErrorMessage 并成一份，取鸭子类型那族语义 ([de4e2d0](https://github.com/ikenxuan/kkkkkk-10086/commit/de4e2d04b47a984f1d5a648157aa777255d4d398))
* **utils:** 删掉零引用的 changelog 解析与 9 个 richtext 构造函数 ([68863cf](https://github.com/ikenxuan/kkkkkk-10086/commit/68863cf740fc18c8d7adda9a3137f27f55b23dfc))


### ✅ 测试

* tests/ 进仓库，check 链补上 typecheck:test / test / test:dist ([d3e5c94](https://github.com/ikenxuan/kkkkkk-10086/commit/d3e5c94f034e42e1cad225dae4a98b9dcfd1d9dd))

## [2.38.4](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.38.3...v2.38.4) (2026-08-22)


### 🐛 Bug 修复

* **douyin:** 图集/合辑/文章不再被挡在作品信息图之外 ([ae543b5](https://github.com/ikenxuan/kkkkkk-10086/commit/ae543b5cad92ec0d7cbe2fabb295762d065e7960))
* **douyin:** 封面去掉本地私加的黑色渐变罩，覆盖层文字回到上游配色 ([edd7fdd](https://github.com/ikenxuan/kkkkkk-10086/commit/edd7fdd9a5d1689f76925dad1860d271e2eb9dbf))
* **request:** UA 不再无条件覆盖 amagi，避免指纹自相矛盾触发 B站风控 ([5408cd8](https://github.com/ikenxuan/kkkkkk-10086/commit/5408cd8ef105e9ca01e512c418fda968be3251e7))


### 📝 文档

* **guoba:** 补回锅巴面板被抹掉的选项说明 ([e2d1717](https://github.com/ikenxuan/kkkkkk-10086/commit/e2d1717ec37e9b6724f3b697ce7dcd4a06cb5772))

## [2.38.3](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.38.2...v2.38.3) (2026-08-21)


### 🐛 Bug 修复

* **bilibili:** 播放地址避开 PCDN 节点，改用接口给的备用地址 ([a6f8463](https://github.com/ikenxuan/kkkkkk-10086/commit/a6f8463bff8400b35d6a33d98df6dc0f378802a7))
* **push:** 单个订阅失败不再中断整轮推送；四角衬底改成上游那圈白边 ([d667849](https://github.com/ikenxuan/kkkkkk-10086/commit/d667849e860cdb6ae4118a6e4d3970a5ad4cd8ff))


### ⚡ 性能优化

* **parse:** 评论图改成独立分支，三条分支互不等待 ([0986048](https://github.com/ikenxuan/kkkkkk-10086/commit/09860486e4d095daf7bc04e13978e6190ffa9f19))

## [2.38.2](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.38.1...v2.38.2) (2026-08-21)


### 🐛 Bug 修复

* **push:** 修主人收不到推送错误图，并解除 QQBot 主动推送拦截 ([e425763](https://github.com/ikenxuan/kkkkkk-10086/commit/e425763c36eb1272861346f4aa1386d79d8c7233))

## [2.38.1](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.38.0...v2.38.1) (2026-08-21)


### 🐛 Bug 修复

* **footer:** 插件名与框架名锁 nowrap 并降一档字号，彻底不再换行 ([641efde](https://github.com/ikenxuan/kkkkkk-10086/commit/641efde0ffc1477ac8e7f6d027c5fcda36ac8c3c))

## [2.38.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.37.1...v2.38.0) (2026-08-21)


### ✨ 新功能

* **update:** #kkk更新日志 挪到 update.ts，改出 git 提交而不是整份 CHANGELOG ([bbafbe5](https://github.com/ikenxuan/kkkkkk-10086/commit/bbafbe5cc952e4ed185efd92fa1d014f275d2dff))


### 🐛 Bug 修复

* **footer:** 构建标识挪到版本号下面一行，修 Stable 通道下页脚被挤成两行 ([274c7c0](https://github.com/ikenxuan/kkkkkk-10086/commit/274c7c0ba7e0ad224ac9e281e46f2211dfce44fe))

## [2.37.1](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.37.0...v2.37.1) (2026-08-21)


### 🐛 Bug 修复

* **ci:** 显式清空 exclude_assets，别再删掉 master 上的 .github ([569dfae](https://github.com/ikenxuan/kkkkkk-10086/commit/569dfae9b39fa3dc67039552d02baaf9bd622142))

## [2.37.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v2.36.0...v2.37.0) (2026-08-21)


### ✨ 新功能

* **assets:** swap the framework and in-card logos ([66d067f](https://github.com/ikenxuan/kkkkkk-10086/commit/66d067f6b334b926a1b8d654ea8fea7761c4428b))
* derive the release channel from the installed branch ([9dd444d](https://github.com/ikenxuan/kkkkkk-10086/commit/9dd444d2702946fa2a3af4c000bd2d20d56fc681))
* **douyin:** 接上喜欢列表 / 推荐列表两张专用推送卡 ([c467723](https://github.com/ikenxuan/kkkkkk-10086/commit/c467723c8a681d120fdc7230cb5fc0da35272dc2))
* **error-card:** 补上 QQBot 适配器图标 ([dfc5ba1](https://github.com/ikenxuan/kkkkkk-10086/commit/dfc5ba1e73d0c25be38664c9ede7e62d18b839dc))
* **footer:** 页脚版本号后面补 git describe 风格的构建标识 ([aa31995](https://github.com/ikenxuan/kkkkkk-10086/commit/aa31995773c2ce059056f1dcb55d1fdb951decee))
* **help:** kkk版本 照搬上游，改出运行环境诊断卡 ([9b3169d](https://github.com/ikenxuan/kkkkkk-10086/commit/9b3169d535f25ac4082f4cab69dc4d57bb82baa9))
* **help:** 接上宿主版本告警卡，声明最低 Yunzai 版本 ([f5f8315](https://github.com/ikenxuan/kkkkkk-10086/commit/f5f8315e7c8d3b94ef6faa3fa4cde3b6c9b1c500))
* migrate React templates to standalone runtime ([c322256](https://github.com/ikenxuan/kkkkkk-10086/commit/c32225668ff812129bf7c9026623af5f73eca522))
* port Karin KKK runtime to Yunzai ([0471487](https://github.com/ikenxuan/kkkkkk-10086/commit/0471487d2ae9c2f7a7f368088b4cb9f1dd0273ba))
* **render:** 单图 png 路径下恢复卡片圆角，白边问题量化定位 ([ac5cbe1](https://github.com/ikenxuan/kkkkkk-10086/commit/ac5cbe1babcb96fa38d7f137e43df016b657ce9d))
* **render:** 卡片对齐上游圆角，成图改成透明 png 并自己分片 ([31e6462](https://github.com/ikenxuan/kkkkkk-10086/commit/31e6462f9915925498c69f17bd92a568ed7f93aa))
* sync xiaohongshu v2.42.1 support ([98d9a7c](https://github.com/ikenxuan/kkkkkk-10086/commit/98d9a7ce79cf29891a5d908800f16a9ac0117697))
* **types:** Render() 按路由校验模板 payload 契约 ([4755288](https://github.com/ikenxuan/kkkkkk-10086/commit/4755288f3ad1239b7e1df0c2cee7cc1a4bbced0c))


### 🐛 Bug 修复

* **apps:** 修复帮助、更新日志与两张统计卡片的数据契约 ([636c964](https://github.com/ikenxuan/kkkkkk-10086/commit/636c964775232f4cd8a318502c044a6e669f615f))
* **apps:** 拆开 #kkk更新 与 #kkk更新日志 的规则重叠 ([60a13d6](https://github.com/ikenxuan/kkkkkk-10086/commit/60a13d60b773ec9d82c0720da7493e6ea7437feb))
* **bilibili:** 动态路由改传富文本数据，修掉 React 模板必炸的几处 ([e057528](https://github.com/ikenxuan/kkkkkk-10086/commit/e05752822e34a0a21b45435cb1a2680cac8c6c45))
* **bilibili:** 视频简介图必炸 —— desc 传 HTML 字符串、ctime 传日期字符串 ([49dbbfd](https://github.com/ikenxuan/kkkkkk-10086/commit/49dbbfdf6f88c2897f41c17a08fcf0b3cd81c79d))
* **bilibili:** 重写评论数据构造以对上 React 模板契约 ([4452d37](https://github.com/ikenxuan/kkkkkk-10086/commit/4452d37cab8eef1eaa89222633f50c36a4e26bf5))
* **bilibili:** 重建番剧卡片数据，存量契约违约清零 ([d2c1409](https://github.com/ikenxuan/kkkkkk-10086/commit/d2c140988e830b1d88585571d213092254a963ce))
* capture log context on the paths that had none ([03bf25c](https://github.com/ikenxuan/kkkkkk-10086/commit/03bf25cadc99fbcb8a3c0f145db4538ddd58158e))
* **deps:** date-fns 挪进 dependencies，并加一道发布前的运行时依赖审计 ([d4cee6c](https://github.com/ikenxuan/kkkkkk-10086/commit/d4cee6c3db5b9b8be10c619e52d5644ef9eef775))
* **douyin:** 修复直播卡片与推送列表卡片的数据契约 ([69b1650](https://github.com/ikenxuan/kkkkkk-10086/commit/69b16503d0548c13b2b93ac0396ca30f043922e4))
* **douyin:** 视频信息图照搬上游 renderWorkImage，修复 SSR 崩溃 ([39b5980](https://github.com/ikenxuan/kkkkkk-10086/commit/39b598080a46c1821ac6d615a30264077edc37ad))
* **douyin:** 评论图 payload 照搬上游，补上崩溃的 Statistics ([c89a97c](https://github.com/ikenxuan/kkkkkk-10086/commit/c89a97c4f589720d4bf49e368fc173efa5a8355c))
* **error-card:** 错误卡片 payload 收窄成契约形状 ([cd56a1b](https://github.com/ikenxuan/kkkkkk-10086/commit/cd56a1b670353bf6c52183dbcea43a8284157373))
* **kuaishou:** 评论卡片改出富文本文档，修掉三处必炸/内容丢失 ([6aa5d23](https://github.com/ikenxuan/kkkkkk-10086/commit/6aa5d23d4ef4851ca016e5b7206341af9639f002))
* make template tooling and CI cross-platform ([3d26ecd](https://github.com/ikenxuan/kkkkkk-10086/commit/3d26ecdb48a48b1066fa519be06699dacfc37c82))
* publish dev builds to preview branch ([8905f6c](https://github.com/ikenxuan/kkkkkk-10086/commit/8905f6cd4831c2a62fc52f6ae3b000d56e6e2b9a))
* put real error details, icons and a footer back on the error card ([0eb2744](https://github.com/ikenxuan/kkkkkk-10086/commit/0eb2744c242b215375882ad75746ea302de0c974))
* **render:** 四角改成不透明衬底，SYSTEM_READY 让开左上角点阵 ([3873b15](https://github.com/ikenxuan/kkkkkk-10086/commit/3873b155ad3158aff744d76290180356e97a5c07))
* stop swallowing platform parse errors so the ErrorHandler tier engages ([9fdd42a](https://github.com/ikenxuan/kkkkkk-10086/commit/9fdd42abd01dc5775fc47795d5cddd1dd17af81a))
* **template:** 去掉卡片圆角，消除成图四角的白色三角 ([5766273](https://github.com/ikenxuan/kkkkkk-10086/commit/5766273b215dac63871ad29367bc51788cc8e1db))
* **tools:** 解析规则不再吞掉 #kkk解析统计 ([b70836e](https://github.com/ikenxuan/kkkkkk-10086/commit/b70836ebe993046ddefa1cd485c6aed20640bc2c))
* write XMP/Exif markers as escapes instead of raw NUL bytes ([bf15e8c](https://github.com/ikenxuan/kkkkkk-10086/commit/bf15e8c9112e8ac020f34033ae298e11461647c4))
* **xiaohongshu:** 两条路由改传契约形状，修掉三处实测必炸 ([4c3314c](https://github.com/ikenxuan/kkkkkk-10086/commit/4c3314cdaa2dd927d94e4bbf61238dba1e279df0))
* 修复 QQBot 下视频被发两遍 ([c2a91a6](https://github.com/ikenxuan/kkkkkk-10086/commit/c2a91a64365bbda68165d8b93b3d1659f1a69312))


### 📝 文档

* add install and development guide ([13a0332](https://github.com/ikenxuan/kkkkkk-10086/commit/13a0332b42cc4af353f07eba03e037ac4b3c9d0a))
* **changelog:** 补全 v1.9.0 到 v2.36.0 之间缺失的 175 条历史 ([b9fe354](https://github.com/ikenxuan/kkkkkk-10086/commit/b9fe354c6a5a8401933e3aa94fab9c34802ff95f))
* README 补上怎么切换已安装的分支 ([bd07289](https://github.com/ikenxuan/kkkkkk-10086/commit/bd07289c0bac062ba3e8cd101ffcbd5833e360d1))
* 修正 master 的定位 ([84205ed](https://github.com/ikenxuan/kkkkkk-10086/commit/84205ed8c6f500e52d46360129fbe0fc229cf1eb))
* 大标题补上 emoji，并修正 release 分支的来源 ([ee9fdd6](https://github.com/ikenxuan/kkkkkk-10086/commit/ee9fdd638f94efc9c1ae1db489a1fd228ffd1170))
* 鸣谢补上 KaguyaJs/Yunzai-DF-Plugin ([ce59ee8](https://github.com/ikenxuan/kkkkkk-10086/commit/ce59ee8e986ff1f343083afe0f616673852ab57c))


### 🎨 代码风格/格式

* **template:** 页脚照搬上游 DefaultLayout 布局 ([22de9ac](https://github.com/ikenxuan/kkkkkk-10086/commit/22de9ac41beba2bacc7ad97bffcbea810e4cc2b5))


### ♻️ 重构

* drop the dead React SSR helper modules ([c9f9e11](https://github.com/ikenxuan/kkkkkk-10086/commit/c9f9e1102b2c64ec1a619caff9b6244965b1519d))
* remove art-template rendering path ([f54ed6d](https://github.com/ikenxuan/kkkkkk-10086/commit/f54ed6d8d79c216f9c1a45ffeb2fe3256d44f499))
* **richtext:** 核心移进 src/，@kkk/richtext 按 tsconfig 分别解析 ([9d215bd](https://github.com/ikenxuan/kkkkkk-10086/commit/9d215bdbf7a36e1279f8425c27cd9d6ce5d8de89))
* use @/ path aliases instead of relative imports ([9713a47](https://github.com/ikenxuan/kkkkkk-10086/commit/9713a4748aee65b375f6b71e854e88213bb4b71b))


### 📦 依赖更新

* amagi 6.5.0, template-react 0.1.0, drop an inert override ([24177aa](https://github.com/ikenxuan/kkkkkk-10086/commit/24177aa77252509fba50197ced27cb02da7b1c0c))
* 跟进上游 111609fa 的依赖升级 ([e930051](https://github.com/ikenxuan/kkkkkk-10086/commit/e9300515869cca968bb636d8f4d5fcadb1c28453))


### 🏗️ 构建/打包

* enforce the @/ import convention across the toolchain ([0b20872](https://github.com/ikenxuan/kkkkkk-10086/commit/0b20872162f887399618c4df1c44a93147229ff3))


### 🤖 CI/CD 配置

* anchor releases on v{version} tags so the two release lines agree ([a969364](https://github.com/ikenxuan/kkkkkk-10086/commit/a9693643ea0e740efb1ea486ac2a3fe7d6218376))
* 发布产物改推 master，并按 master 的定位重写文档 ([2eb418c](https://github.com/ikenxuan/kkkkkk-10086/commit/2eb418cc8e3dab7ad661ce6a2cb187dbfea9c5ad))
* 发布推送改用 keep_files，不再需要 PAT；工作流名统一带 emoji ([928a825](https://github.com/ikenxuan/kkkkkk-10086/commit/928a825274317d14fc6d714ce75125eb02a474ff))

## [2.36.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.9.0...v2.36.0) - Karin 2.36.0 迁移版

> 测试版：如遇到兼容性或功能问题，请提交 issue 反馈。

### 迁移要点

* 完整迁移 Karin 插件 2.36.0 的配置、依赖、API 服务、统计、推送预览、平台扫码登录、错误处理、模板与静态资源。
* 补齐抖音、哔哩哔哩、快手、小红书解析与推送相关能力，并适配 Yunzai 运行时。
* 新增 `other/help`、`other/changelog`、`other/handlerError`、`other/live-photo-tip`、`other/version_warning`、平台二维码等模板。
* 配置入口迁移到锅巴面板，独立 Web 配置面板不再随 Yunzai 版提供。

### ✨ 新功能

* 更新依赖并改进平台ID获取逻辑 ([b92d4b3](https://github.com/ikenxuan/kkkkkk-10086/commit/b92d4b34edcd852ad256d64f52949243ad904deb))
* **配置:** 优化抖音和B站推送配置并添加分享类型选项 ([0ff3bf8](https://github.com/ikenxuan/kkkkkk-10086/commit/0ff3bf87896d554a3f751a3b0bff33c826bfa24e))
* 添加bilibili播放图标和logo图片资源 ([d934052](https://github.com/ikenxuan/kkkkkk-10086/commit/d93405213c357097331ed1d0fad58fb0de9c94c5))
* **网络模块:** 优化下载功能并添加断点续传支持 ([41fc4a6](https://github.com/ikenxuan/kkkkkk-10086/commit/41fc4a6a029f2f518ce99d02f69e3d5c63be3683))
* **下载:** 添加直播流下载支持及相关配置选项 ([e6a9af8](https://github.com/ikenxuan/kkkkkk-10086/commit/e6a9af889ba807b7cccf940833bbde4abb1ea7cb))
* **guoba:** 添加upload配置项支持 ([5382155](https://github.com/ikenxuan/kkkkkk-10086/commit/5382155ee1b1654cc0df83b8551741544a55dacf))
* **help:** 重构帮助图 UI 为奶油可爱风并修复文字背景对比度问题 ([#112](https://github.com/ikenxuan/kkkkkk-10086/issues/112)) ([9214531](https://github.com/ikenxuan/kkkkkk-10086/commit/921453181dcb3b5f7c864d79675772462d09056b))
* **ICQQ:** 添加ICQQ适配器视频上传特殊处理 ([c771000](https://github.com/ikenxuan/kkkkkk-10086/commit/c771000e1f3f3b307225db22e33e7b25e9dc1980))
* multithread download ([#114](https://github.com/ikenxuan/kkkkkk-10086/issues/114)) ([da8629f](https://github.com/ikenxuan/kkkkkk-10086/commit/da8629f99cbe6ca162bbf0471bc2e2c2ded73a41))
* **Networks:** 增强下载功能并改进错误重试逻辑 ([b78a809](https://github.com/ikenxuan/kkkkkk-10086/commit/b78a8098268880bf958e71339d4db9c4c7140975))
* **utils:** 添加apiError路径并优化图片消息发送 ([255c91a](https://github.com/ikenxuan/kkkkkk-10086/commit/255c91a7ff9e0e3099884a803ac0b1662db124ca))
* **YamlReader:** 支持带点号的键名路径操作 ([88b86d0](https://github.com/ikenxuan/kkkkkk-10086/commit/88b86d031687d655fc5200d8149855be8577ade6))

### 🐛 Bug 修复

* `kkk设置` 报错 ([#99](https://github.com/ikenxuan/kkkkkk-10086/issues/99)) ([16b775f](https://github.com/ikenxuan/kkkkkk-10086/commit/16b775fc313100ee082bc44ae5e631c0bdc32aa9))
* 当 bilibilinumcomments 设置为 0 时，防止动态 API 出现错误（[#96](https://github.com/ikenxuan/kkkkkk-10086/issues/96)） ([de12cc2](https://github.com/ikenxuan/kkkkkk-10086/commit/de12cc22069a6c21a6e042e7c98fdc69dd15ddff))
* 调整输入范围和修改代理端口组件类型 ([f758438](https://github.com/ikenxuan/kkkkkk-10086/commit/f758438df8da53a1500f6974aedefce04ae3bdbd))
* 将代理密码输入框组件改为InputPassword类型 ([461ddd3](https://github.com/ikenxuan/kkkkkk-10086/commit/461ddd31b14cbe9fcebf34ee243dcc36e3cba211))
* 没有修复视频上传逻辑并移除冗余检查 ([8c640d7](https://github.com/ikenxuan/kkkkkk-10086/commit/8c640d7d568e88e99ffc88e0954a66230f7c7c10))
* **配置表单:** 完善抖音和B站解析选项的表单配置 ([395593a](https://github.com/ikenxuan/kkkkkk-10086/commit/395593adbf59ad91f06f05a5b49b6b1fa760922e))
* **配置同步:** 调整配置同步到数据库的逻辑 ([ec5eb24](https://github.com/ikenxuan/kkkkkk-10086/commit/ec5eb24c72c2da21ad493ae10e14db512816c2b2))
* **平台推送:** 修复shouldFilter返回值类型标注问题 ([e9c0bc1](https://github.com/ikenxuan/kkkkkk-10086/commit/e9c0bc12f8f2ca4aa1aa1869d75f80ec34a29b58))
* 统一使用common模块处理转发消息 ([a2511b8](https://github.com/ikenxuan/kkkkkk-10086/commit/a2511b81d084522a9daafe20d71319478b5cee2c))
* **推送模块:** 修复图片转发消息的格式和空数组检查 ([9bf7eef](https://github.com/ikenxuan/kkkkkk-10086/commit/9bf7eef40a402f5913babe0b22fe61a4632db8e7))
* **网络:** 改进下载错误处理和重试逻辑 ([98b04eb](https://github.com/ikenxuan/kkkkkk-10086/commit/98b04ebf6a5966627d02fc1561097a77200bd572))
* **网络请求:** 优化网络请求和下载逻辑 ([fb973cf](https://github.com/ikenxuan/kkkkkk-10086/commit/fb973cfab30491b3e5cdf08371d3c1fb876a2526))
* **网络请求:** 在重试时创建新的HTTP/HTTPS代理连接 ([7a341e9](https://github.com/ikenxuan/kkkkkk-10086/commit/7a341e9f9fc3bb68367665f59289f2b6eded4f67))
* **网络:** 优化网络连接池配置和下载重试逻辑 ([8d14a81](https://github.com/ikenxuan/kkkkkk-10086/commit/8d14a81e51d165b699f0d6c767328e0b04ba8a43))
* **下载:** 改进下载进度显示和文件大小处理 ([8c179cd](https://github.com/ikenxuan/kkkkkk-10086/commit/8c179cd9e5e49609955f3e30a0ccb78e9a2bfebd))
* **下载进度:** 改进直播流和未知大小文件的进度显示 ([c791ce8](https://github.com/ikenxuan/kkkkkk-10086/commit/c791ce8cd5f333bb119f16f3154b2c7717fa9a20))
* **下载进度:** 修复首次下载进度不更新的问题并优化进度显示 ([097a941](https://github.com/ikenxuan/kkkkkk-10086/commit/097a941cd5c81f5992ef9a12fa9d752801be6c5d))
* **下载:** 添加参数验证防止进度计算错误 ([41527b0](https://github.com/ikenxuan/kkkkkk-10086/commit/41527b0493e4b2d5f3feb48ac2cb0104b44d66bb))
* 修复 B站用户 UID 上限过小导致大 UID 无法输入的问题 ([#113](https://github.com/ikenxuan/kkkkkk-10086/issues/113)) ([56b7bd6](https://github.com/ikenxuan/kkkkkk-10086/commit/56b7bd6c9b4cb767786ebeeb97f6ae93f2f5bbac))
* 修复多个平台推送和上传功能的问题 ([ba73d8c](https://github.com/ikenxuan/kkkkkk-10086/commit/ba73d8c0195b15d09754e26145ce9f0debd69ca8))
* 修复配置保存逻辑并简化群组ID获取 ([085e01f](https://github.com/ikenxuan/kkkkkk-10086/commit/085e01f7ce8709da98591dc39233319051d3cf62))
* 修复配置初始化问题并优化下载进度显示 ([bf207f0](https://github.com/ikenxuan/kkkkkk-10086/commit/bf207f0ecb4f60f8f959c503cac14b2c9e878f99))
* 修复上传语音时未检查bot.config存在导致的潜在错误 ([49ab7e9](https://github.com/ikenxuan/kkkkkk-10086/commit/49ab7e93cd4a5c5a49cea71f80f8d4e6ac271fb8))
* 修复视频上传后未正确处理返回状态的问题 ([5b25c44](https://github.com/ikenxuan/kkkkkk-10086/commit/5b25c44b3e8cb815e28000ac53005486783b8ac2))
* 修复Bot对象可选链操作和类型导入问题 ([f0b5014](https://github.com/ikenxuan/kkkkkk-10086/commit/f0b5014b7941695905d45942f6a2b938c0fd98c8))
* 修复icqq多次上传的问题 ([3a985fc](https://github.com/ikenxuan/kkkkkk-10086/commit/3a985fc372f288c095c236e9c3f2d7ff567ecf3f))
* 修复QQBot适配器检测逻辑并添加错误提示 ([8546978](https://github.com/ikenxuan/kkkkkk-10086/commit/854697880c2fdf75ea4e4c519a5e1a55ae1f2d87))
* 修正动态过滤逻辑默认返回值错误 ([8a5137b](https://github.com/ikenxuan/kkkkkk-10086/commit/8a5137bf4318019159dae760320230acfbf8f7eb))
* 修正消息ID字段名从messageId到message_id ([42b3d7c](https://github.com/ikenxuan/kkkkkk-10086/commit/42b3d7ce5c7695e44750c1b20139ff12245fc06c))
* 移除对ICQQ适配器的冗余检查 ([6e297d6](https://github.com/ikenxuan/kkkkkk-10086/commit/6e297d65f44dc4ee7de57d85b02ecdadb3c7ebba))
* 移除下载进度更新间隔并优化网络请求头获取 ([fa7da95](https://github.com/ikenxuan/kkkkkk-10086/commit/fa7da9509ce33f737f6e0a16d69a7ab9e13730d8))
* 移除引用解析里平台配置检查中的enabled条件 ([14a2157](https://github.com/ikenxuan/kkkkkk-10086/commit/14a215745408c3b346fd39401093f8c2f8d7ad1b))
* **admin:** 修复配置命令匹配大小写和空格问题 ([b899de6](https://github.com/ikenxuan/kkkkkk-10086/commit/b899de680defc1c3e97482a2bef617c6c7b5dcfe))
* **admin:** 修复配置命令正则表达式特殊字符转义问题 ([b894f8a](https://github.com/ikenxuan/kkkkkk-10086/commit/b894f8ad946d17fdac8397ec9aaa2a2c5a9cd177))
* **bilibili,douyin:** 优化视频请求头和错误处理逻辑 ([d42dd88](https://github.com/ikenxuan/kkkkkk-10086/commit/d42dd880fafc32ca7b57c0b81a44f91b8669951c))
* **bilibili/douyin:** 修复未登录时视频清晰度选择及群组消息发送问题 ([089850c](https://github.com/ikenxuan/kkkkkk-10086/commit/089850c50d01b6545cc8dfe9eedaab03cb209572))
* **bilibili:** 改进AV/BV号转换和链接匹配逻辑 ([07476f6](https://github.com/ikenxuan/kkkkkk-10086/commit/07476f6b410528b8174d24cb49aa0491d448bbe1))
* **bilibili:** 排除视频快速链接解析 ([fd04cfa](https://github.com/ikenxuan/kkkkkk-10086/commit/fd04cfa8ac2d74434083134ad0d484c907a86060))
* **bilibili:** 添加大小写不敏感匹配并更新群号信息 ([3563e0d](https://github.com/ikenxuan/kkkkkk-10086/commit/3563e0dd40aa22cfadc38baf46b5c810fc03206b))
* **bilibili:** 添加动态解析选项并优化表情数据处理 ([448d0f7](https://github.com/ikenxuan/kkkkkk-10086/commit/448d0f7a88b6c0e29052c801b9f5520e5d8a7a08))
* **bilibili:** 添加AV/BV号大小写不敏感匹配 ([9855fa7](https://github.com/ikenxuan/kkkkkk-10086/commit/9855fa7c66c7cc90c2ff7975881cd3aba21f6a55))
* **bilibili:** 添加av号支持并更新提示信息 ([fdb9ea2](https://github.com/ikenxuan/kkkkkk-10086/commit/fdb9ea2f66afc0a63efd8ea71a095d8f893b6161))
* **bilibili:** 修复动态图片和评论图的回复顺序问题 ([626aed4](https://github.com/ikenxuan/kkkkkk-10086/commit/626aed4538a603b495c45d076e1795ab9416860b))
* **bilibili:** 修复评论显示逻辑并优化抖音URL匹配 ([5e098e7](https://github.com/ikenxuan/kkkkkk-10086/commit/5e098e73a933496f87553c6f797efbc40edd101c))
* **bilibili:** 修复图片URL为空时的默认值处理 ([6df4009](https://github.com/ikenxuan/kkkkkk-10086/commit/6df40092972573de593fb9afec8de066815d6943))
* **bilibili:** 修复B站链接和BV号处理逻辑 ([e507584](https://github.com/ikenxuan/kkkkkk-10086/commit/e507584ce890dfb758bdc7e3a59d21c313b0c024))
* **bilibili:** 修正视频大小计算使用错误数据源的问题 ([c2d80a7](https://github.com/ikenxuan/kkkkkk-10086/commit/c2d80a74d2dc91c26070e89cb342874bb816b25e))
* **bilibili:** 修正视频大小计算中使用错误数据路径的问题 ([4c62b4d](https://github.com/ikenxuan/kkkkkk-10086/commit/4c62b4d57e6b4834bc392b68342eb263c7228807))
* **bilibili:** 修正视频清晰度和大小获取的数据路径问题 ([7073f50](https://github.com/ikenxuan/kkkkkk-10086/commit/7073f50e805a6b2db6d8c90bbb9794925faf89cf))
* **bilibili:** 移除下载请求中的Cookie并修复Referer和Origin头 ([bb8160c](https://github.com/ikenxuan/kkkkkk-10086/commit/bb8160c8e00051caa53c558f495ed47c0980555c))
* **bilibili:** 移除已废弃的动态卡片接口调用 ([#110](https://github.com/ikenxuan/kkkkkk-10086/issues/110)) ([662dc7b](https://github.com/ikenxuan/kkkkkk-10086/commit/662dc7b84c9e394123698bec55070280ac91795f))
* **bilibili:** 转发的 Bilibili 绘画/文字动态处理时出现的空指针错误（[#92](https://github.com/ikenxuan/kkkkkk-10086/issues/92)） ([e9a0957](https://github.com/ikenxuan/kkkkkk-10086/commit/e9a0957dc9b33a5e75699d63ccef1263197385cb))
* **bilibili:** normalize playurl response ([90aeef8](https://github.com/ikenxuan/kkkkkk-10086/commit/90aeef8e398643e7fc4e18fd2ba879bf9e078baa))
* **db:** 处理并发创建群组记录时的SQLITE_CONSTRAINT错误 ([5587b5c](https://github.com/ikenxuan/kkkkkk-10086/commit/5587b5c483061bb81af9759a087c1b1f3c557512))
* **db:** 处理群组创建时的并发冲突问题 ([46119b0](https://github.com/ikenxuan/kkkkkk-10086/commit/46119b06d6d187ad79dfc15efea0709d2649a20b))
* **db:** 将日期格式从toLocaleString改为toISOString ([76106dd](https://github.com/ikenxuan/kkkkkk-10086/commit/76106ddc007c7c1f17e167594634c0e57732de7e))
* **db:** 统一使用ISO格式日期并优化备注显示逻辑 ([431a685](https://github.com/ikenxuan/kkkkkk-10086/commit/431a68512523c189be662fa94673e7b514d09564))
* **db:** 修复并发插入时群组数据可能丢失的问题 ([fa7397d](https://github.com/ikenxuan/kkkkkk-10086/commit/fa7397d5d80943ab3efc8cd5f029dc6e4d362f19))
* **db:** 修复群组查询并添加机器人ID更新逻辑 ([902f6e8](https://github.com/ikenxuan/kkkkkk-10086/commit/902f6e8f31f01acf826a4f45cedb454a6d4b6697))
* **db:** 修复群组记录查询失败时自动创建记录的问题 ([a3c12e0](https://github.com/ikenxuan/kkkkkk-10086/commit/a3c12e0c4e76e59e65417c659cb716b2e6d0fda5))
* **douyin:** 将returnResult方法改为request方法以修复请求问题 ([2964723](https://github.com/ikenxuan/kkkkkk-10086/commit/29647235fbe35ec1b530b7ddef65bd5b5a1aea1e))
* **douyin:** 修复抖音解析和推送中的错误处理 ([fc320d0](https://github.com/ikenxuan/kkkkkk-10086/commit/fc320d01d0df79422ecc1510a8a324a8ed61c37f))
* **douyin:** 修复抖音视频和音频下载的Referer头 ([c7c8367](https://github.com/ikenxuan/kkkkkk-10086/commit/c7c836793c0c23714f9e7c2b4987ad7c68fa12f5))
* **douyin:** 修复视频下载请求头错误并更新分享链接请求头 ([e87e283](https://github.com/ikenxuan/kkkkkk-10086/commit/e87e28376557d4373a981c13a212cabe693c30f6))
* **douyin:** 修正图片消息发送方式并添加推送开关选项 ([5ef9e61](https://github.com/ikenxuan/kkkkkk-10086/commit/5ef9e61280314fc2a9ea53dc67639808307d9101))
* **douyin:** 在音乐信息中添加重定向id字段 ([e66c87c](https://github.com/ikenxuan/kkkkkk-10086/commit/e66c87c2b2c0a0a07449b6f7a1ebf45e0c7f43b0))
* duplicate push issue for Bilibili and Douyin dynamics ([d62052b](https://github.com/ikenxuan/kkkkkk-10086/commit/d62052b3bc113f1c76d3811a74e9d7653659b272)), closes [#94](https://github.com/ikenxuan/kkkkkk-10086/issues/94)
* **ICQQ适配器:** 修复视频上传函数缺少文件参数的问题 ([ef7ea17](https://github.com/ikenxuan/kkkkkk-10086/commit/ef7ea17c79457babce065426bcb36bd94a4e766b))
* **network:** 加入没用的熔断机制并优化网络请求配置 ([e6f54f2](https://github.com/ikenxuan/kkkkkk-10086/commit/e6f54f21ee6e8f3dd211b228c0cd0a032b443985))
* **Networks:** 调整请求超时时间从60秒降至30秒 ([6a4a9f7](https://github.com/ikenxuan/kkkkkk-10086/commit/6a4a9f7edaffca928e8fe62fb04e6c277a03079e))
* **Networks:** 改进下载进度计算和头信息处理 ([52f83fe](https://github.com/ikenxuan/kkkkkk-10086/commit/52f83feb5218f4b6b28942f38513b7c4452681b2))
* **Networks:** 修复下载进度计算中除零错误 ([98067a3](https://github.com/ikenxuan/kkkkkk-10086/commit/98067a366a0759c389e4c935cb9b5c5d0cccc77a))
* **Networks:** 修复下载文件大小验证和进度更新问题 ([8306797](https://github.com/ikenxuan/kkkkkk-10086/commit/8306797f3ca90cca151ddcf9cc66ad2dfeb77de1))
* **Networks:** 修复循环重定向检测并优化重定向逻辑 ([dbf02d9](https://github.com/ikenxuan/kkkkkk-10086/commit/dbf02d9919fac2308031dd366ed7e5a9afa40b8e))
* **Networks:** 修复重试时连接池问题并优化错误处理逻辑 ([182fe79](https://github.com/ikenxuan/kkkkkk-10086/commit/182fe79e47232d61d71e8c7d3b1768d486366a0c))
* **Networks:** 修复SSL连接问题和改进重试逻辑 ([6d91823](https://github.com/ikenxuan/kkkkkk-10086/commit/6d91823207a20c18f47c2455a9074c7369afd21f))
* **Networks:** 修改重定向次数过多时的处理逻辑 ([ceeddc0](https://github.com/ikenxuan/kkkkkk-10086/commit/ceeddc0c2d129826b9c344d76cc17ad8d1ede8a9))
* **Networks:** 移除重复的httpsAgent ([52a3a49](https://github.com/ikenxuan/kkkkkk-10086/commit/52a3a49431fccd4ef89d2b23e1827d56cf7b65da))
* **Networks:** 移除validateStatus以使用默认状态码验证 ([9d861e3](https://github.com/ikenxuan/kkkkkk-10086/commit/9d861e3060fc75b049d452248387cec43ca2dbc4))
* **Networks:** 优化断点续传逻辑并修复文件大小检测问题 ([c42d99a](https://github.com/ikenxuan/kkkkkk-10086/commit/c42d99af8fc080ea6d2bf3efae92a6d8be28c002))
* **Networks:** 优化网络请求处理与重试逻辑 ([0e4ca26](https://github.com/ikenxuan/kkkkkk-10086/commit/0e4ca26784d72166447112ec9d4fea45f9753db5))
* **Networks:** 优化重试逻辑和超时设置 ([41971ba](https://github.com/ikenxuan/kkkkkk-10086/commit/41971baa0c9f71fbf6f832251a08a4bbe3ffa606))
* **Networks:** 增强网络请求功能与错误处理 ([073dfd4](https://github.com/ikenxuan/kkkkkk-10086/commit/073dfd4394fb6780b56f51f821273baebe6783d3))
* **Networks:** 增强下载流功能并添加直播流支持 ([ad279e0](https://github.com/ikenxuan/kkkkkk-10086/commit/ad279e0f96f18b22bc5839ec11a822eafbd320f7))
* **platform/bilibili:** 优化视频流请求参数生成和网络请求配置 ([00ec3c0](https://github.com/ikenxuan/kkkkkk-10086/commit/00ec3c0b621790f6da52a18c9413af0b639f862e))
* **platform:** 修复Miao-Yunzai下转发消息生成方式 ([e8dd86a](https://github.com/ikenxuan/kkkkkk-10086/commit/e8dd86aaf13faf59112918ab3983b42dd35ecea3))
* **platform:** 修正消息ID字段名并优化抖音请求头 ([5e0cf1e](https://github.com/ikenxuan/kkkkkk-10086/commit/5e0cf1e5f610b441710a32fe68a46da6a2e2b6f3))
* **push:** 更正推送权限配置路径 ([14b2046](https://github.com/ikenxuan/kkkkkk-10086/commit/14b2046e35bfcbc7e0ef24cf6def13276239613e))
* **push:** 修复强制推送命令的正则匹配问题 ([8e33321](https://github.com/ikenxuan/kkkkkk-10086/commit/8e333216f0da5e80327253724f4b7381cc4e5126))
* replace deprecated Bilibili amagi API ([1e1d841](https://github.com/ikenxuan/kkkkkk-10086/commit/1e1d8414ece2dd2ee36b198d0f72e3d6d853ca68))
* replace deprecated douyin amagi API ([9b629b9](https://github.com/ikenxuan/kkkkkk-10086/commit/9b629b9623f78545f6f83010702d28dabfd60916))
* resolve issues 104 105 107 ([cd68893](https://github.com/ikenxuan/kkkkkk-10086/commit/cd688931c3c12df4111e29f2d20699bcdcd03eb3))
* **tools:** 改进音乐数据获取失败的错误提示信息 fix(bilibili): 修复动态卡片图片未定义时的处理 refactor(FFmpeg): 重构FFmpeg工具类并添加完整类型定义 refactor(UploadRecord): 重构音频上传逻辑，优化错误处理和资源清理 ([482a31e](https://github.com/ikenxuan/kkkkkk-10086/commit/482a31e6a43404f0b76343a8899e744323ac14eb))
* **tools:** 更新抖音平台正则匹配规则以支持移动端域名 ([867be81](https://github.com/ikenxuan/kkkkkk-10086/commit/867be81ea959fe2371e6a406c0d39be9df918926))
* **tools:** 修复抖音平台正则表达式匹配问题 ([3dc204b](https://github.com/ikenxuan/kkkkkk-10086/commit/3dc204b10d187299728d51e5e9af9209a6aedef5))
* **tools:** 修复有文案时匹配不了的情况 ([20f139c](https://github.com/ikenxuan/kkkkkk-10086/commit/20f139c653d90711b999bb3c580b15d4ce8acd69))
* **tools:** 修复bilibili链接正则表达式匹配问题 ([1cb9b5a](https://github.com/ikenxuan/kkkkkk-10086/commit/1cb9b5a6337187bb2955c439a20cb5729d5f639b))
* **tools:** 修正bilibili链接匹配的正则表达式 ([6a431b5](https://github.com/ikenxuan/kkkkkk-10086/commit/6a431b53c8eadaaa41d0d542ee2131094bc84a36))
* Update @ikenxuan/watermark dependency version [#107](https://github.com/ikenxuan/kkkkkk-10086/issues/107) ([10fa7ae](https://github.com/ikenxuan/kkkkkk-10086/commit/10fa7aee3d3041cbbc1ec31c9577f66bda8bbb04))
* **UploadRecord:** 修复音频文件处理和上传逻辑 ([5adc532](https://github.com/ikenxuan/kkkkkk-10086/commit/5adc532741a7a1df5831a120606b1dfb366225cb))
* **utils:** 根据机器人框架选择不同的着色方法 ([b97f1d1](https://github.com/ikenxuan/kkkkkk-10086/commit/b97f1d1a37c3bd892b58e62cc25e2d3f2a70176c))
* **utils:** 修复下载文件进度条颜色方法调用问题 ([8450ee4](https://github.com/ikenxuan/kkkkkk-10086/commit/8450ee4bf435a46c75856f9061d3baed2968a078))
* **utils:** 修复下载文件进度条颜色方法调用问题 ([6f3c7bf](https://github.com/ikenxuan/kkkkkk-10086/commit/6f3c7bf9a01be1cd28ceabc6c51614dd75ab37ef))
* **utils:** 修复下载文件进度条颜色方法调用问题 ([a18f69e](https://github.com/ikenxuan/kkkkkk-10086/commit/a18f69e67604f3349cb43f22c60b0aefff14b390))
* **utils:** 修复ICQQ适配器消息处理并添加网络请求重试机制 ([c977d9c](https://github.com/ikenxuan/kkkkkk-10086/commit/c977d9c38aef8f86b3dafab9aab5185fa057a0d5))
* **utils:** 修正 ICQQ 适配器在线状态检查逻辑 ([28c0c27](https://github.com/ikenxuan/kkkkkk-10086/commit/28c0c271942b11684e8f53b50092d78efff7e1fc))
* **utils:** 优化网络请求相关功能 ([67e102a](https://github.com/ikenxuan/kkkkkk-10086/commit/67e102acdd3ea6b5c0bbd37d7b0c617e4b0a5ca2))
* **xiaohongshu:** 笔记获取失败时抛出 Amagi 返回的具体错误信息 ([34ba0b0](https://github.com/ikenxuan/kkkkkk-10086/commit/34ba0b0fdb26e20cb73e702ffeecc4dfcb340e18))
* **xiaohongshu:** 迁移 Amagi 废弃 API ([#111](https://github.com/ikenxuan/kkkkkk-10086/issues/111)) ([80d46cf](https://github.com/ikenxuan/kkkkkk-10086/commit/80d46cfc207b01ae15f51841353e56817c3aa873))

### ⚡ 性能优化

* **Networks:** 优化网络请求配置和下载性能 ([00ce7eb](https://github.com/ikenxuan/kkkkkk-10086/commit/00ce7ebda7e67a0642a612a560cadb2f3c46e399))

### 📝 文档

* add multithread download design ([4aebc3f](https://github.com/ikenxuan/kkkkkk-10086/commit/4aebc3fa87547eb6dba225e262677461a0b3f3ec))
* **guoba:** 修正视频上传相关选项的文案描述 ([7d52583](https://github.com/ikenxuan/kkkkkk-10086/commit/7d5258311eb330febe5dab4d686a38325a5e6a7e))

### 🎨 代码风格/格式

* **admin/css:** 调整顶部栏高度和行高以改善视觉效果 ([87689e9](https://github.com/ikenxuan/kkkkkk-10086/commit/87689e9cfb1eb8ce04e72856ef11d9e6d121a684))
* **css:** 移除未使用的样式并优化文本溢出处理 ([c9d6cb8](https://github.com/ikenxuan/kkkkkk-10086/commit/c9d6cb82e621c289dbe6663bf6eee05a7b248c4f))

### ♻️ 重构

* **抖音:** 更新用户代理和优化抖音ID获取逻辑 ([6cd5451](https://github.com/ikenxuan/kkkkkk-10086/commit/6cd5451ac6c7d134f71f77e891222ab26bb4e3be))
* **配置同步:** 重构配置同步逻辑并添加双向同步功能 ([3b8ad92](https://github.com/ikenxuan/kkkkkk-10086/commit/3b8ad9223ddd033875c761c671a65a33eeb8e276))
* 统一使用Render函数替代Render.render方法 ([2e62416](https://github.com/ikenxuan/kkkkkk-10086/commit/2e624164afded363d3098715e7c7407cdf3776b6))
* 统一字段命名规范并简化类型注释 ([41e6f5f](https://github.com/ikenxuan/kkkkkk-10086/commit/41e6f5f3691e647ca04f5cb912ad6a9a6fa22ef0))
* **推送模块:** 移除多余空行并补充返回类型注释 ([1962893](https://github.com/ikenxuan/kkkkkk-10086/commit/1962893af94b2c18d6a1ee8421962290d5ce8f1b))
* **推送模块:** 移除多余headers并统一转发消息生成方式 ([9196b5e](https://github.com/ikenxuan/kkkkkk-10086/commit/9196b5eccdde61fd534076c9e10bd84fb16ed8a2))
* **网络请求:** 统一使用Networks类处理平台链接获取 ([a23d0c6](https://github.com/ikenxuan/kkkkkk-10086/commit/a23d0c6dad95afa68a2f117ad707b65b3c9fd703))
* **下载:** 改进下载进度显示逻辑和文件大小验证 ([c2154b7](https://github.com/ikenxuan/kkkkkk-10086/commit/c2154b729f26128615facda4c74ec626a98e6a81))
* 优化导入语句，直接导入Config类 ([961fda1](https://github.com/ikenxuan/kkkkkk-10086/commit/961fda1e6ae7b654aa5a863d4ecc300f1683ed82))
* 优化目录创建和数据库初始化流程 ([58b72b7](https://github.com/ikenxuan/kkkkkk-10086/commit/58b72b72d59651cccce3e044df6a9d4c6360acbd))
* 优化推送功能代码并改进重定向处理 ([c4e272b](https://github.com/ikenxuan/kkkkkk-10086/commit/c4e272bdb314a452447f98f0a9081409e8978837))
* 重构配置系统并优化模块导入 ([42d56e0](https://github.com/ikenxuan/kkkkkk-10086/commit/42d56e0bd2a7b8f0bc4805a496294912de519911))
* **admin:** 重构管理面板配置逻辑和模板 ([944cd16](https://github.com/ikenxuan/kkkkkk-10086/commit/944cd16fcbc29822c70ffb0a4a49f9b682022a15))
* **config:** 重构配置管理和GUI界面 ([bbda8de](https://github.com/ikenxuan/kkkkkk-10086/commit/bbda8de1982c95b59d854f7c66b8d8eb12851d26))
* **Config:** 重构数据库同步逻辑并合并重复代码 ([07bbe4c](https://github.com/ikenxuan/kkkkkk-10086/commit/07bbe4cada89a4ce3d82656c12b917cb8fc8c76c))
* **db:** 简化群组创建逻辑并统一处理日期转换 ([f543ab8](https://github.com/ikenxuan/kkkkkk-10086/commit/f543ab85b52c521fcd5a2666d9bfad00ef3982ba))
* **db:** 简化群组记录创建逻辑并移除冗余代码 ([e613a37](https://github.com/ikenxuan/kkkkkk-10086/commit/e613a37053fa09c856ce1de5822d541793c36ccc))
* **db:** 统一数据库模块中的字符串引号为单引号 ([9d5f2b5](https://github.com/ikenxuan/kkkkkk-10086/commit/9d5f2b5e14a49c15c1211e46cc1d9d7afa081a0d))
* **db:** 优化数据库操作并添加外键约束 ([877d5f1](https://github.com/ikenxuan/kkkkkk-10086/commit/877d5f14bc499dbc4a9d160a6a0300c669aa89ca))
* **db:** 优化数据库模块导出和初始化逻辑 ([101405e](https://github.com/ikenxuan/kkkkkk-10086/commit/101405e847d0dab8f15e0bcdc79203709f3674f5))
* **douyin:** 优化订阅管理逻辑并移除冗余try-catch块 ([7942817](https://github.com/ikenxuan/kkkkkk-10086/commit/79428172213af8902aecf28c7b8022eeeba6d0ea))
* **Networks:** 简化网络请求和下载逻辑 ([23a4fff](https://github.com/ikenxuan/kkkkkk-10086/commit/23a4fff1c4498b76c882557c046680321406c357))
* **Networks:** 移除默认headers配置 refactor(douyin): 简化headers配置为baseHeaders refactor(bilibili): 简化headers配置为baseHeaders ([98da802](https://github.com/ikenxuan/kkkkkk-10086/commit/98da802b71ca7a666c096eda6aba8225908ea804))
* **Networks:** 移除熔断机制并优化下载逻辑 ([764cb2e](https://github.com/ikenxuan/kkkkkk-10086/commit/764cb2e8116bc056c3e9968776b98b15f231efb5))
* **Networks:** 优化下载进度更新逻辑和进度条显示 ([eb1be69](https://github.com/ikenxuan/kkkkkk-10086/commit/eb1be69a1bc7dd09116eaf94b08b0f948adee86f))
* **Networks:** 优化下载流方法实现并提升可靠性 ([5425abe](https://github.com/ikenxuan/kkkkkk-10086/commit/5425abe3d295ad10cce6049d2f390cc336d729e4))
* **Networks:** 优化下载逻辑，提取头信息获取方法 ([86e67f8](https://github.com/ikenxuan/kkkkkk-10086/commit/86e67f881ae498a8469155641bfc42ad1e724c62))
* **Networks:** 优化重试时的HTTP代理创建逻辑 ([8d84791](https://github.com/ikenxuan/kkkkkk-10086/commit/8d8479171dea8d354bda4d512a9aafbe8b6eec0c))
* **Networks:** 重构错误处理和简化请求方法 ([4d590ac](https://github.com/ikenxuan/kkkkkk-10086/commit/4d590accadf81013e5fd153de7a2d7d6466ccf73))
* **Networks:** 重构网络请求类并优化下载功能 ([e493695](https://github.com/ikenxuan/kkkkkk-10086/commit/e493695db431db4856b865b4b5f40b5078bb91eb))
* **platform:** 简化群组ID获取逻辑 ([658782b](https://github.com/ikenxuan/kkkkkk-10086/commit/658782b823d0909383f5f15b4a4fdc002967d813))
* **platform:** 统一使用group_id和self_id替代groupId和selfId ([4c70a3f](https://github.com/ikenxuan/kkkkkk-10086/commit/4c70a3fe15c66eda3d8e1c191f168f774c6b5265))
* **push:** 将并行操作改为顺序执行以提高稳定性 ([d736acf](https://github.com/ikenxuan/kkkkkk-10086/commit/d736acf39c9c053503b3298cf25327d3860cd566))
* **push:** 优化B站和抖音推送逻辑，提高性能 ([d34fd09](https://github.com/ikenxuan/kkkkkk-10086/commit/d34fd09d059c1e5df1809680413a4167abf9f1d6))
* **UploadRecord:** 优化语音消息上传逻辑 ([6eadb84](https://github.com/ikenxuan/kkkkkk-10086/commit/6eadb845ab6f2d4f2c49ecbcbba51aab95a582d3))
* **utils:** 简化视频上传逻辑并修复类型声明 ([853bffd](https://github.com/ikenxuan/kkkkkk-10086/commit/853bffd56b3c17c257681e5f8c6dc3e76eed83cb))
* **utils:** 将console.error替换为logger.error以统一日志记录 refactor(db): 优化数据库模块的导出方式并清理冗余代码 ([ac1b618](https://github.com/ikenxuan/kkkkkk-10086/commit/ac1b618aa4df4ffbd1ff161eb7be137c7caa9fc7))
* **utils:** 将console.log替换为logger.info以统一日志输出 ([8c17948](https://github.com/ikenxuan/kkkkkk-10086/commit/8c17948bd352cb6036baad898492b37c06d2b8f2))
* **utils:** 使用path.sep替代硬编码的路径分隔符 ([bde7a24](https://github.com/ikenxuan/kkkkkk-10086/commit/bde7a2402724b193be52fe4613722497b26a408b))
* **utils:** 统一错误消息字段并移除ICQQ视频上传适配代码 ([93c9e95](https://github.com/ikenxuan/kkkkkk-10086/commit/93c9e9548a900824754d38c62a5280eed68dbb41))

### ✅ 测试

* migrate 2.36.0 beta to Guoba panel ([f60d3da](https://github.com/ikenxuan/kkkkkk-10086/commit/f60d3da20df0db7bbf53ebaf5875981773d0d25c))

### 🏗️ 构建/打包

* 更新依赖包版本 ([ba045c7](https://github.com/ikenxuan/kkkkkk-10086/commit/ba045c7fac3ce9dcd92df95a0ba65d3cff38fbe7))
* 添加 jsconfig.json 配置文件以支持现代 JavaScript 开发 ([6381aa1](https://github.com/ikenxuan/kkkkkk-10086/commit/6381aa1f51061943e48634ec9d6a5b471534a0ce))
* 移除未使用的sqlite3依赖 ([568e5a0](https://github.com/ikenxuan/kkkkkk-10086/commit/568e5a0abfdcfbeaf1a54c984a3f625b9a4b248a))
* **资源:** 添加HarmonyOS_SansSC_Regular.woff2字体文件 ([c58a236](https://github.com/ikenxuan/kkkkkk-10086/commit/c58a23650d92bfabbf5e95ac36bbee712439a8cb))
* **deps:** 更新 sqlite3 依赖并调整类型定义配置 ([#102](https://github.com/ikenxuan/kkkkkk-10086/issues/102)) ([10b7778](https://github.com/ikenxuan/kkkkkk-10086/commit/10b777857bf133f0693a4be8b52cd75d5903efa2))
* **deps:** 更新 sqlite3 依赖至 0.4.3 ([a9d2449](https://github.com/ikenxuan/kkkkkk-10086/commit/a9d244914ce95957a0d761d7051f566bf5041c7e))

### ⏪ 回滚

* **Networks:** 优化断点续传逻辑并修复文件大小检测问题 ([b96ef7b](https://github.com/ikenxuan/kkkkkk-10086/commit/b96ef7bdad5a92ac4510788a2a4b3d266d2a3e29))

### 🔎 其他变更

* 更新README ([7d77fb3](https://github.com/ikenxuan/kkkkkk-10086/commit/7d77fb35b04e692b9c3f78e1e67a99d419a45727))

## [1.9.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.8.0...v1.9.0) (2025-09-14)


### Features

* **apiError:** 新增API错误页面模板和样式 ([53ca98f](https://github.com/ikenxuan/kkkkkk-10086/commit/53ca98f51772e17b3f52df9e71465d6800c64d8c))
* **bilibili:** 添加8K画质选项并优化自动画质选择逻辑 ([c37a13a](https://github.com/ikenxuan/kkkkkk-10086/commit/c37a13af2548bf2404a1e7ad2ce53c722d34131f))
* **bilibili:** 添加生成请求参数和检查cookie的功能 ([5e9f7e4](https://github.com/ikenxuan/kkkkkk-10086/commit/5e9f7e45e0df785d896410fa00aff17dcfe39d4d))
* **bilibili:** 添加视频画质偏好设置选项 ([ba3f904](https://github.com/ikenxuan/kkkkkk-10086/commit/ba3f904fe27023a0e32764c0c1c8689a5d278c38))
* **bilibili:** 添加视频画质选择值到返回对象 ([f721c97](https://github.com/ikenxuan/kkkkkk-10086/commit/f721c971a5c2a56cb71cb4419d73850123054ec2))
* **bilibili:** 添加视频简介显示内容配置选项 ([74120e2](https://github.com/ikenxuan/kkkkkk-10086/commit/74120e2e6edc50e65098f843178546722f8bc482))
* **bilibili:** 添加自动画质模式下最大视频大小限制 ([977f5d0](https://github.com/ikenxuan/kkkkkk-10086/commit/977f5d041a4147582f7f1dae81101e37dbffa95c))
* **db:** 新增B站和抖音数据库模块及推送功能 ([1ce06e8](https://github.com/ikenxuan/kkkkkk-10086/commit/1ce06e8b3c4295384a567f898bc4a7e8950353c3))
* **guoba:** 优化锅巴配置中的主题配置，修复FFmpeg带空格路径错误 ([9c9cea3](https://github.com/ikenxuan/kkkkkk-10086/commit/9c9cea363912e4a3af1cab9ec9770893c3797f84))
* 可选解析内容，废弃原本配置，更新后请重新配置 ([f51b35e](https://github.com/ikenxuan/kkkkkk-10086/commit/f51b35e73b545e6424590168c7099f7e3990253c))
* 更新依赖并优化抖音和B站功能 ([0905b78](https://github.com/ikenxuan/kkkkkk-10086/commit/0905b78d420fa25b810c1258dd15846d35d5e203))
* **模板:** 添加API错误页面的HTML和CSS模板 ([256c81a](https://github.com/ikenxuan/kkkkkk-10086/commit/256c81ad89f864c55406bac92354695b077467ab))
* 添加bilibili动态的可选项，未测试，有bug请移步issue ([c0fc5bc](https://github.com/ikenxuan/kkkkkk-10086/commit/c0fc5bc71701c1f542e191482c18f02e43e2e23b))
* 添加抖音是否发送背景音乐配置项 ([a3126ef](https://github.com/ikenxuan/kkkkkk-10086/commit/a3126ef08c378c5d755d6a3ce7dde59bb5fa3c17))


### Bug Fixes

* **bilibili:** 修复VIP状态检查时的潜在空引用错误 ([7114392](https://github.com/ikenxuan/kkkkkk-10086/commit/7114392809de13b2751863ff74457e826ac5411a))
* **bilibili:** 修复动态文本获取路径错误 ([5b18d8d](https://github.com/ikenxuan/kkkkkk-10086/commit/5b18d8d30ad45aabc6d6c1da5728f2c4c8ffff53))
* **bilibili:** 修复动态类型解析错误和样式问题 ([53ca98f](https://github.com/ikenxuan/kkkkkk-10086/commit/53ca98f51772e17b3f52df9e71465d6800c64d8c))
* **bilibili:** 修复合并文件路径中OBJECT数据结构引用错误 ([dc4a358](https://github.com/ikenxuan/kkkkkk-10086/commit/dc4a35893c1569b7621d224358d3fa3b38151935))
* **bilibili:** 修复推送动态类型判断和渲染问题 ([0905b78](https://github.com/ikenxuan/kkkkkk-10086/commit/0905b78d420fa25b810c1258dd15846d35d5e203))
* **bilibili:** 修复视频动态发送时的潜在空引用错误 ([fbe0062](https://github.com/ikenxuan/kkkkkk-10086/commit/fbe0062cf670b33bded73c9aa5a74e0a14d4fd96))
* **bilibili:** 修复视频清晰度显示逻辑错误 ([2ef93f9](https://github.com/ikenxuan/kkkkkk-10086/commit/2ef93f97b7002699d6aa44e0fd2a7f761c4b9b60))
* **bilibili:** 修复视频链接处理逻辑并优化显示文本 ([372f811](https://github.com/ikenxuan/kkkkkk-10086/commit/372f81129e7291f8865085441c244ab5851a1c8e))
* **bilibili:** 修复获取数据时未正确处理响应的问题 ([3e1d73d](https://github.com/ikenxuan/kkkkkk-10086/commit/3e1d73d9d3ccf9f8705a033fe72c357b08d97b9b))
* **bilibili:** 修复默认清晰度显示问题 ([662c677](https://github.com/ikenxuan/kkkkkk-10086/commit/662c6770a1e8b7ba4206ea7520203e4233364269))
* **bilibili:** 修正视频清晰度选择逻辑错误 ([24e473f](https://github.com/ikenxuan/kkkkkk-10086/commit/24e473fe705f95669c4466ed8be261c7d300e3bc))
* **bilibili:** 修正获取用户动态和主页数据时错误的host_mid参数 ([e66e016](https://github.com/ikenxuan/kkkkkk-10086/commit/e66e0162bfde701c854406b8cf474dd5dac3148d))
* **bilibili:** 修正转发动态渲染方法调用错误 ([4acd48e](https://github.com/ikenxuan/kkkkkk-10086/commit/4acd48e985bc7c75f1a4ef73e4814613251cbee6))
* **bilibili:** 添加生成B站动态卡片渐变样式功能缺失的函数 ([0e76428](https://github.com/ikenxuan/kkkkkk-10086/commit/0e76428d1c8c88f08bd88fb1ed5eb5c92bf26e1c))
* **bilibili:** 添加视频数据为空时的错误处理 ([28f50af](https://github.com/ikenxuan/kkkkkk-10086/commit/28f50af6f15790b8574030e883929a42a438d501))
* **bilibili:** 添加视频质量参数到bilibiliProcessVideos调用 ([5a0b82b](https://github.com/ikenxuan/kkkkkk-10086/commit/5a0b82b4c1db15055cca389587b00f0bc03b1824))
* **douyin:** 修复GetDouyinID调用缺少参数e的问题 ([78aa42a](https://github.com/ikenxuan/kkkkkk-10086/commit/78aa42af002059269855e2338ae6b647d6f22df6))
* **douyin:** 修复HEIC图片转换时的请求头问题 ([0a8996f](https://github.com/ikenxuan/kkkkkk-10086/commit/0a8996fbdffd18a5cbeab902dd79ebd8afe1e2f3))
* **douyin:** 修复Render方法调用错误 ([03e8548](https://github.com/ikenxuan/kkkkkk-10086/commit/03e854863ed0dc6142ffeee417ed8dfb95b8930d))
* **douyin:** 修复抖音模块数据访问路径错误并更新依赖 ([2de376a](https://github.com/ikenxuan/kkkkkk-10086/commit/2de376a603e2714f444e82fa06a9b7f8571b551b))
* **douyin:** 修复评论数据处理中的变量引用和emoji替换逻辑 ([5e6d8ed](https://github.com/ikenxuan/kkkkkk-10086/commit/5e6d8ed913111f3f9e62293f300c353daac3e3f4))
* **douyin:** 修正 Networks 请求类型为 arrayBuffer 并为 getDouyinData 方法添加 cookies 参数 ([04018f3](https://github.com/ikenxuan/kkkkkk-10086/commit/04018f3ccb83ec1f4149db662302ddd6b284d368))
* **douyin:** 修正文件扩展名前缺少点号的问题 ([9d044cc](https://github.com/ikenxuan/kkkkkk-10086/commit/9d044cc53934c81ab79898b043116d34eb9fa1f9))
* **douyin:** 修正视频下载格式参数为字符串类型 ([c6275f6](https://github.com/ikenxuan/kkkkkk-10086/commit/c6275f6bc865f3aac3cefd4445b9c39c8d83638c))
* **douyin:** 修正评论图片处理中的方法名和缓冲区转换问题 ([a0b45f0](https://github.com/ikenxuan/kkkkkk-10086/commit/a0b45f0a9963613b34e14aee283e2510c082c088))
* **douyin:** 修正音乐播放URL引用变量名从data改为MusicData ([5d7568e](https://github.com/ikenxuan/kkkkkk-10086/commit/5d7568e85f889491a2c323ce6a8bf949ed6bfa10))
* **douyin:** 在GetDouyinID调用中添加this.e参数 ([c472817](https://github.com/ikenxuan/kkkkkk-10086/commit/c4728179f6e196700a655f1bc3f13a78c30c8ca6))
* **douyin:** 移除DownLoadVideo方法中多余的参数this.e ([84d04d4](https://github.com/ikenxuan/kkkkkk-10086/commit/84d04d41de02bb940ee6c22184b4cc15d5bdd91f))
* **douyin:** 移除视频下载文件名中的.mp4后缀 ([804b4e2](https://github.com/ikenxuan/kkkkkk-10086/commit/804b4e20d24bb82759b1ea7892c96fa332fc6463))
* **douyin:** 移除视频文件名中的标题以避免特殊字符问题 ([e330865](https://github.com/ikenxuan/kkkkkk-10086/commit/e33086502e5799a7341c2de2317296a11630cf2a))
* **platform/bilibili:** 修复登录消息中文本段未使用segment的问题 ([82bcac5](https://github.com/ikenxuan/kkkkkk-10086/commit/82bcac544ec352f0682a3963c28e8e4895b2cb85))
* **platform/bilibili:** 修复登录状态下视频优先级判断逻辑 ([b97e7da](https://github.com/ikenxuan/kkkkkk-10086/commit/b97e7da530fca4c7e78b1f55e80c556d1640c099))
* **platform/bilibili:** 修正评论数据请求参数名错误 ([8849837](https://github.com/ikenxuan/kkkkkk-10086/commit/88498376c716ad7fdc316f760ddd1cbc2a4faf13))
* **utils:** 修复Base.js中Config请求参数的默认值处理 ([803b20c](https://github.com/ikenxuan/kkkkkk-10086/commit/803b20c0c73acce6a0b34800bf0ecc846500f64a))
* 优化代码结构 ([09b168a](https://github.com/ikenxuan/kkkkkk-10086/commit/09b168ab3ff62e35072bd3cca3577ab41188d049))
* 修复videoSize is not defined问题，修复B站Emoji数据无法获取问题 ([35e8baf](https://github.com/ikenxuan/kkkkkk-10086/commit/35e8baff287078cbbbf3a2e0749a9ce1dfc7fc15))
* 修复加载失败 ([d499c27](https://github.com/ikenxuan/kkkkkk-10086/commit/d499c2740f328100af4b9e1f1a1aa7f28f63df8a))
* 修复抖音评论图设置无效 ([69d55a2](https://github.com/ikenxuan/kkkkkk-10086/commit/69d55a29ad8173f845e7d77b09cf359107c28061))
* 修复抖音评论图配置无效 ([264c407](https://github.com/ikenxuan/kkkkkk-10086/commit/264c40766287566e963705a84faed34f873f4526))
* 修复文件大小限制检查使用错误配置项的问题 ([e3ec8c7](https://github.com/ikenxuan/kkkkkk-10086/commit/e3ec8c7bc4b37da8201ea0d1b5246b987aead685))
* 修正BiLiBiLi构造函数参数传递错误 ([7b1009e](https://github.com/ikenxuan/kkkkkk-10086/commit/7b1009e480d5a7fa7eef9a3ab1783ea7b9c8c2f2))
* 将APIServer配置项更正为APIServerPort ([1245810](https://github.com/ikenxuan/kkkkkk-10086/commit/12458106e747ac2e75bdd7f490894a504a462be6))
* **抖音评论:** 修正HEIC图片转换时arrayBuffer参数错误 ([d7513c0](https://github.com/ikenxuan/kkkkkk-10086/commit/d7513c032c2e71ea5629634f1a31c2e9918fe784))
* **推送服务:** 修复B站和抖音推送数据处理错误 ([1130a36](https://github.com/ikenxuan/kkkkkk-10086/commit/1130a360a12fa3c013cb3ccee9104b93f35461d6))


### Performance Improvements

* 优化网络请求和文件下载处理 ([0905b78](https://github.com/ikenxuan/kkkkkk-10086/commit/0905b78d420fa25b810c1258dd15846d35d5e203))

## [1.8.0](https://github.com/ikenxuan/kkkkkk-10086/compare/v1.7.2...v1.8.0) (2025-05-27)


### Features

* **tools:** 添加修改推送机器人功能 ([ef584cf](https://github.com/ikenxuan/kkkkkk-10086/commit/ef584cf45f67c5f997478edcf8ab8ba044b622ec))
* **utils:** 添加常用工具类Common.js ([e04683a](https://github.com/ikenxuan/kkkkkk-10086/commit/e04683a740dc173635fb318d0185b69e100a95ec))
* 添加深色主题支持并优化动态渲染逻辑 ([1f9419b](https://github.com/ikenxuan/kkkkkk-10086/commit/1f9419b70b111f2a71f72acc068e530e841e5a45))


### Bug Fixes

* **admin:** 移除群文件上传相关配置 ([260ee98](https://github.com/ikenxuan/kkkkkk-10086/commit/260ee98584d29c406d106ae3979060a585c8af9a))
* **bilibili:** 修正视频数据请求的描述字段 ([6ab4c5e](https://github.com/ikenxuan/kkkkkk-10086/commit/6ab4c5e0753e29e8c95c0753bb196d87006b3d8a))
* **help.js:** 修正html文件路径错误 ([5fdf593](https://github.com/ikenxuan/kkkkkk-10086/commit/5fdf5934de3cbe4c03b7d2b6417bb2e1d4d62c5f))
* **html:** 修复默认模板中CSS文件路径错误 ([a359d69](https://github.com/ikenxuan/kkkkkk-10086/commit/a359d691208a3861593c1eed12681ea6199b356a))
* **Pushlist:** 修复 ([7d14fb8](https://github.com/ikenxuan/kkkkkk-10086/commit/7d14fb89f533cfb133bfaea38808f21a84b9f4bd))
* **Pushlist:** 修复平台判断条件以仅匹配douyin ([61ad225](https://github.com/ikenxuan/kkkkkk-10086/commit/61ad225b6fb262f9fa4da821caacf00f99c1930f))
* **Pushlist:** 修复渲染选项未正确传递的问题 ([94a34df](https://github.com/ikenxuan/kkkkkk-10086/commit/94a34dff2934b9e0464bb975fa80e0b689b0367a))
* **Render:** 不是函数 ([eebb48e](https://github.com/ikenxuan/kkkkkk-10086/commit/eebb48e4cb89570af615a1e9d57ba0da8f347d96))
* **update.js:** 修正 kkkkkk-10086 插件更新及日志指令的处理逻辑 ([3b7af0c](https://github.com/ikenxuan/kkkkkk-10086/commit/3b7af0c904d447e59b1442abb931b63d72df4084))
* 修复B站推送功能并更新渲染格式 ([cbd0172](https://github.com/ikenxuan/kkkkkk-10086/commit/cbd0172ec813da0734ced227f1b5f859f28aca28))
* 修复版本页面渲染 ([8600da5](https://github.com/ikenxuan/kkkkkk-10086/commit/8600da5c1ba5d0e9b1c07197d7e1050c95f69f5a))
* 修复转发函数导入 ([eeb63ec](https://github.com/ikenxuan/kkkkkk-10086/commit/eeb63ecfa313d9c8d462b1e799c0cd2185a5afbf))
* 修正 update.js 中导入外部 update 模块的方式 ([c399aa0](https://github.com/ikenxuan/kkkkkk-10086/commit/c399aa0cb6ac7ff863927d5ec6fb6fde4b569455))
* 修正following_count字段引用错误 ([152b060](https://github.com/ikenxuan/kkkkkk-10086/commit/152b060f619fa0bf9f9877c878b956ff615a1b3c))
* 函数修正 ([71f5eef](https://github.com/ikenxuan/kkkkkk-10086/commit/71f5eef7365c43ee2e406bd7c80cb0297465c7cf))
* 改改改 ([3dfc86f](https://github.com/ikenxuan/kkkkkk-10086/commit/3dfc86f049694d840248bf21ccd84dfe1e3365b2))
* **渲染:** 修正git状态显示中的空格格式问题 ([806e529](https://github.com/ikenxuan/kkkkkk-10086/commit/806e529869bb5a57e1b2036a16bd0f1a7e964948))
* 漏网之鱼 ([180bf22](https://github.com/ikenxuan/kkkkkk-10086/commit/180bf224390f35805731c7348ff91be037bb1754))
* 移除gitstatus返回字符串中的多余空格 ([cfade8b](https://github.com/ikenxuan/kkkkkk-10086/commit/cfade8ba18d7425047c4b2e56288669d503b1839))
* 移除未使用的logger导入 ([88cb589](https://github.com/ikenxuan/kkkkkk-10086/commit/88cb589c41c5f4592a027609eb7ac30f67fcd494))

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
