# 小红书 v2.42.1 同步计划

## 目标

跟进 `karin-plugin-kkk` v2.42.1 中与云崽插件实际架构相关的小红书变更，同时保持云崽本体 Puppeteer 渲染、现有 `DefaultLayout` 页脚和当前 React 模板注册方式不变。

## 文件范围

生产代码：

- `src/apps/tools.ts`：识别 `xhslink.cn`。
- `src/module/utils/Common.ts`：二维码/支持链接识别 `xhslink.cn`。
- `src/module/platform/xiaohongshu/getid.ts`：支持 `target_note_id`、普通 `redirectPath`、query/hash 中的 `xsec_token`。
- `src/module/platform/xiaohongshu/xiaohongshu.ts`：向 noteInfo 传入图集和视频状态。
- `ktr/template/xiaohongshu/noteInfo/components/types.ts`：扩展模板数据类型。
- `ktr/template/xiaohongshu/noteInfo/components/noteInfo.tsx`：迁移 v2.42.1 的布局层级和视觉结构，保留云崽页脚资源。

本地验证文件：

- `tests/xiaohongshu-v2421.test.ts`：只在本地运行，不纳入 Git 跟踪。

## 实施顺序

1. 先添加覆盖旧链接、新域名、`target_note_id`、重定向和 hash token 的回归测试。
2. 运行测试确认新用例失败，且失败原因是缺少目标行为而不是导入或环境错误。
3. 修改解析规则、业务数据映射和 React 模板。
4. 运行测试、两套 TypeScript 检查、模板同步、完整构建、打包和产物审计。
5. 显式暂存生产文件，确认 `tests/**` 未跟踪，提交并推送 `dev`，再观察 CI 与 `dev -> preview`。

## 验证命令

```text
pnpm test
pnpm typecheck:test
pnpm typecheck:template
pnpm verify
pnpm pack
node --test tests/contracts/no-art-template.test.mjs
git diff --check
git ls-files -- tests
git ls-files -- resources/template
```

## 完成标准

- `xhslink.com`、`xhslink.cn` 和 `xiaohongshu.com` 都能进入小红书解析路径。
- `/explore?target_note_id=...` 能得到 note ID。
- 普通 `redirectPath`、`/404?redirectPath=` 和 query/hash 中大小写两种 `xsec_token` 都能解析。
- noteInfo 能使用图集预览和视频状态，且页脚仍使用云崽插件图标与二维码组件。
- 无 `art-template` 依赖或旧 `resources/template/**` 产物。
- 发布包不包含 `tests/**`，并且本地测试文件仍保留。
