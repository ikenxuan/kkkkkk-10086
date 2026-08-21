import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { PluginPath } from '@/dir'
import { getBuildMetadata } from './build-metadata.js'

/**
 * 发布通道。
 *
 * 不能用「版本号里有没有 `-` 前缀」来判断：`.release-please-config.json` 里
 * `prerelease: false`，release-please 永远不会产出带 `-` 的版本号，那个判断恒为
 * Stable。真正区分安装来源的只有分支。
 */
export type ReleaseChannel = 'Stable' | 'Preview' | 'Dev'

/**
 * 分支 → 发布通道。
 *
 * - `master`：CI 在 dev 上合掉 release-please 的发布 PR 后，构建产物推到的成品分支，
 *   普通用户的稳定线（见 .github/workflows/release-and-push-build.yml）。
 *   重写前它是 JavaScript 源码线，源码提交停在 2026-07-28
 * - `preview`：CI 在每次 dev 推送后构建产物推到的成品分支，愿意吃 bug 的用户
 *   （见 .github/workflows/build-push-preview.yml）
 * - `dev`：开发线源码
 * - `release`：保留映射。这个分支从未被创建过，但历史配置曾指向它，
 *   万一有人手里是那会儿的克隆，不至于被判成 Dev
 */
const CHANNEL_BY_BRANCH: Record<string, ReleaseChannel> = {
  release: 'Stable',
  master: 'Stable',
  main: 'Stable',
  preview: 'Preview',
  dev: 'Dev'
}

/** 安装目录的 git 状态，决定发布通道。 */
export interface InstallState {
  /** 跟踪的远程分支名；判断不出来时为 `null` */
  branch: string | null
  /** 已跟踪文件是否有本地改动；探测不了或探测失败时为 `null` */
  dirty: boolean | null
  /** 本地领先远程的提交数；测不准或测不了时为 `null` */
  ahead: number | null
  /** 状态是从插件自己的 git 仓库读出来的，还是只能靠构建时烘进去的元数据 */
  source: 'git' | 'metadata'
}

let cachedState: InstallState | undefined

/** git 探测的超时时间。见 readGit 的说明：这是跑在渲染路径上的同步调用。 */
const GIT_TIMEOUT_MS = 2000

/** `origin/preview` → `preview`；`@{upstream}` 输出的首段总是远程名。 */
const stripRemote = (ref: string): string => ref.replace(/^[^/]+\//, '')

/**
 * 跑一条 git 命令，失败返回 `null`。
 *
 * 返回 `null` 而不是空串是关键：调用方必须能区分「命令失败」和「命令成功但输出为空」。
 * `status --porcelain` 干净时输出就是空串，如果失败也返回空串，两者会混成同一个值，
 * 一路把探测失败当成「干净」，最后把本地改动标成 Stable。
 *
 * 带 timeout 是因为这个函数在渲染路径上同步执行（Render.ts 调 getReleaseChannel），
 * execFileSync 会阻塞整个事件循环。卡住的 git——.git/index.lock 争用、
 * core.hooksPath 里的钩子、放在网络盘上的仓库——没有超时就是把 bot 冻死。
 */
const readGit = (args: string[]): string | null => {
  try {
    return execFileSync('git', args, {
      cwd: PluginPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 1024 * 1024
    }).trim()
  } catch {
    return null
  }
}

/**
 * 插件目录自己是不是一个 git 仓库的根。
 *
 * 必须先确认这件事，再信任任何 git 探测：git 会沿目录树向上找 `.git`。
 * 压缩包安装的插件目录没有 `.git`，此时所有探测都会去回答宿主 Yunzai 仓库的状态——
 * 那是另一个仓库的分支和干净度，跟插件装的是哪个版本毫无关系。
 * 更糟的是 Yunzai 的 .gitignore 里有 `/plugins/*`，插件文件永远不会出现在宿主的
 * `git status` 输出里，于是「脏」在结构上变得不可能被发现，恒为干净。
 */
const ownsGitRepo = (): boolean => {
  // .git 可能是目录（普通克隆），也可能是文件（worktree / submodule），existsSync 都覆盖。
  if (!existsSync(join(PluginPath, '.git'))) return false
  const top = readGit(['rev-parse', '--show-toplevel'])
  if (!top) return false
  // Windows 上 --show-toplevel 返回正斜杠路径，PluginPath 是反斜杠，必须先归一化。
  return resolve(top) === resolve(PluginPath)
}

/**
 * 本地领先远程多少个提交。测不准就返回 `null`，让调用方降级处理。
 *
 * - 没有配 upstream：`@{upstream}..HEAD` 无从计算，也就证明不了「已经推上去了」。
 *   本地随手 `git checkout -b release` 建出来的分支不能仅凭名字算稳定版。
 * - 浅克隆：这个指标在 graft 截断的历史上根本不成立。remote-tracking ref 被
 *   `git fetch` 推进之后，HEAD 不再可达于 upstream，`--count` 会把 graft 这一侧的
 *   提交数报出来，把「落后」的用户报成「领先」。而 `git clone --depth=1 -b release`
 *   正是文档里最常见的正常安装，所以浅克隆里干脆不看这个指标，只靠 dirty 判断。
 */
const countAhead = (upstream: string | null): number | null => {
  if (!upstream) return null
  if (readGit(['rev-parse', '--is-shallow-repository']) === 'true') return 0

  const raw = readGit(['rev-list', '--count', `${upstream}..HEAD`])
  if (raw === null) return null
  const count = Number.parseInt(raw, 10)
  return Number.isFinite(count) ? count : null
}

/**
 * 采集安装状态。
 *
 * 脏检查用 `-uno` 只看已跟踪文件：Yunzai 插件运行时会往自己目录里写缓存和配置，
 * 把未跟踪文件也算进来的话，正常用户的 release 安装会被误判成本地开发。
 */
export const getInstallState = (): InstallState => {
  if (cachedState !== undefined) return cachedState

  const baked = getBuildMetadata()?.branch
  const bakedBranch = baked && baked !== 'unknown' ? baked : null

  if (!ownsGitRepo()) {
    // 没有自己的仓库 = 压缩包或打包安装。这种安装不可能存在「未推送的提交」，
    // 所以只认烘进去的分支，不去猜干净度——猜出来的也是宿主仓库的。
    cachedState = { branch: bakedBranch, dirty: null, ahead: null, source: 'metadata' }
    return cachedState
  }

  const upstream = readGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  // 分离 HEAD 时 --abbrev-ref HEAD 会返回字面量 HEAD，那不是分支名。
  const local = readGit(['rev-parse', '--abbrev-ref', 'HEAD'])
  const status = readGit(['status', '--porcelain', '-uno'])

  cachedState = {
    branch: upstream ? stripRemote(upstream) : (local && local !== 'HEAD' ? local : bakedBranch),
    dirty: status === null ? null : status !== '',
    ahead: countAhead(upstream),
    source: 'git'
  }
  return cachedState
}

/**
 * 把分支名映射成发布通道。
 *
 * 认不出来的分支（fork、feature 分支）一律算 `Dev`：它定义上就不是已发布的版本。
 */
export const resolveChannel = (branch: string | null): ReleaseChannel => {
  if (!branch) return 'Dev'
  const key = branch.toLowerCase()
  // 必须走 hasOwn：对象字面量继承 Object.prototype，直接索引时一个名叫
  // `constructor` 的分支会命中 Object.prototype.constructor 返回一个函数，
  // `?? 'Dev'` 拦不住它（不是 null/undefined），于是这个声明返回三个字符串之一的
  // 函数会把一个函数交给模板。
  return Object.hasOwn(CHANNEL_BY_BRANCH, key) ? CHANNEL_BY_BRANCH[key]! : 'Dev'
}

/**
 * 当前安装的发布通道，供页脚与运行时信息展示。
 *
 * 工作区脏或本地有未推送的提交时一律降级为 `Dev`：此时跑的是本地改动，
 * 哪怕分支叫 master 也不等于那个已发布的稳定版，标成 Stable 会让错误报告失去意义。
 */
export const getReleaseChannel = (): ReleaseChannel => {
  const state = getInstallState()

  // 只有插件自己的 git 仓库才能证明「没有本地改动」。探测失败（null）不等于干净，
  // 证明不了就降级成 Dev：宁可少标一个 Stable，也不要把本地改动标成稳定版。
  if (state.source === 'git' && (state.dirty !== false || state.ahead !== 0)) return 'Dev'

  return resolveChannel(state.branch)
}

/** 仅供测试：清掉状态缓存。 */
export const resetInstallStateCache = (): void => {
  cachedState = undefined
}
