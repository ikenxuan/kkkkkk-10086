# GitHub Actions 本地验证

本文说明本仓库 GitHub Actions 在本地可验证的范围、当前机器的验证结果，以及不能由本地环境忠实复现的 GitHub 托管能力。

## 当前结论

截至 2026-08-18，当前 Windows 开发环境为：

- Node.js：`v22.18.0`；
- pnpm：`9.15.9`；
- `act`：未安装；
- Docker：未安装；
- `actionlint`：未安装。

因此，**当前不能在本机完整运行 GitHub Actions job**。不过，可以执行两层有效验证：

1. 检查关键 workflow 的 runner、Node、pnpm、安装命令、验证命令和最小权限；
2. 在包含当前未提交改动的临时副本中，执行与 CI 相同的 pnpm 命令层。

`tests/**` 只保留在本地并由 `.gitignore` 排除，不上传源码分支。因此远端 `pnpm check` 只执行 lint、源码类型检查、模板类型检查和完整 TypeScript/Vite 构建；本地仍可按需执行 Vitest。首次干净安装还发现本地测试曾从云崽父级目录隐式解析 `art-template`；现在已将其声明为插件开发依赖并锁定，本地测试不再依赖父目录环境。

本地命令层通过不代表整个 GitHub Actions workflow 已通过；第三方 `uses:` Action、GitHub 事件上下文、令牌权限、Issue API、Release API 和分支推送仍需在 GitHub 测试仓库或真实 workflow 中验证。

## Workflow 可验证范围

| Workflow | 本地可验证 | 仍需 GitHub 验证 |
| --- | --- | --- |
| `ci.yml` | YAML 检查；Windows 上执行 `pnpm install --frozen-lockfile` 与 `pnpm check` | `ubuntu-latest` runner 的真实行为、`actions/checkout`、pnpm/Node setup Action、缓存 |
| `build-push-preview.yml` | YAML 检查；临时副本执行 `pnpm verify`；发布文件准备步骤可单独复现 | Ubuntu runner、`GITHUB_TOKEN`、向 `preview` 分支推送、GitHub 事件字段 |
| `release-and-push-build.yml` | YAML 检查；临时副本执行 `pnpm verify`；发布文件准备步骤可单独复现 | release-please 输出、Release/PR/Issue API、条件步骤、向 `release` 分支推送 |
| `issue_geetings.yml` | YAML 检查；`issues: write` 最小权限 | `issues:labeled` 事件、评论和 reaction API、第三方 Action |
| `issue_welcome.yml` | YAML 检查；`issues: write` 最小权限 | `issues:opened` 事件、欢迎评论、第三方 Action |
| `issue_similarity.yml` | YAML 检查；`issues: write` 最小权限 | Issue 搜索/评论 API、相似度 Action 的运行结果 |
| `stale.yml` | YAML 检查；Issue/PR 写权限 | 定时事件、Issue/PR API、第三方 Action |

## 安全的本地验证命令

### 1. Workflow 静态检查

若本机保留了被忽略的 `tests/**`，可在仓库根目录执行：

```powershell
node --test tests/contracts/workflow-alignment.test.mjs
```

该本地测试会通过 `yaml` 解析关键 workflow，并验证：

- CI 同时声明 `ubuntu-latest` 与 `windows-latest`；
- CI 使用 Node 22、pnpm 9.15.9、冻结锁文件安装和 `pnpm check`；
- Preview/Release 使用 Node 22.12.0、pnpm 9.15.9、冻结锁文件安装和 `pnpm verify`；
- Issue 自动化仅请求 `issues: write`；
- 发布分支、release-please、stale 权限和项目发布契约保持一致。

### 2. 在临时副本复现 CI 命令层

`pnpm check` 会通过 `pnpm build` 删除并重建 `lib/**`。**不要在含有待保留 `lib/**` 改动的原工作树直接执行 `pnpm check` 或 `pnpm verify`。**

下面的 PowerShell 示例会复制当前工作状态，因此也包含尚未提交的文件；它明确排除 `.git` 与 `node_modules`。临时工作目录保留 `kkkkkk-10086` 这个末级名称，并执行一次 `git init`，以模拟 GitHub Checkout：服务测试会读取目录名，`.gitignore` 契约也需要 Git 仓库上下文。

```powershell
$source = (Resolve-Path .).Path
$tempRoot = (Resolve-Path $env:TEMP).Path
$container = Join-Path $tempRoot ("kkkkkk-actions-" + [guid]::NewGuid().ToString('N'))
$work = Join-Path $container 'kkkkkk-10086'

New-Item -ItemType Directory -Path $work | Out-Null
Get-ChildItem -LiteralPath $source -Force |
  Where-Object { $_.Name -notin @('.git', 'node_modules') } |
  ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $work -Recurse -Force
  }

Push-Location $work
try {
  git init --quiet
  pnpm install --frozen-lockfile
  pnpm check
} finally {
  Pop-Location
}
```

完成后，先验证清理目标确实位于系统临时目录，再删除：

```powershell
$resolvedContainer = (Resolve-Path -LiteralPath $container).Path
$resolvedTemp = (Resolve-Path -LiteralPath $env:TEMP).Path
$insideTemp = $resolvedContainer.StartsWith(
  $resolvedTemp.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar,
  [StringComparison]::OrdinalIgnoreCase
)

if (-not $insideTemp) {
  throw "拒绝删除非临时目录：$resolvedContainer"
}

Remove-Item -LiteralPath $resolvedContainer -Recurse -Force
```

该过程只复现当前 Windows 主机上的命令层。CI 的 Ubuntu matrix 项仍必须由 GitHub runner 验证。

## 关于 `act`

即使之后安装 `act`，仍需要 Docker 才能运行其 Linux runner 镜像。`act` 不能忠实模拟 `windows-latest`，也不会天然提供真实仓库事件、GitHub 托管令牌、受保护分支或完整 API 权限。

若未来安装 `act` 与 Docker，建议只把它作为 Linux job 的额外冒烟测试，并继续保留：

- 本仓库的 workflow 契约测试；
- 临时副本中的 Windows 命令层测试；
- GitHub 测试仓库中的 `workflow_dispatch` 或分支触发测试。

涉及发布或 Issue 写入时，应使用专用测试仓库和最小权限令牌，不要在本地模拟中使用生产凭据。
