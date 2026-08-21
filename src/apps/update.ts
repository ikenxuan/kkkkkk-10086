import { execFileSync } from 'node:child_process'

import { PluginPath } from '@/dir'
import { Render } from '@/module/utils/index'
import Version from '@/module/utils/Version'
// 宿主导出的类名是小写的 update，这里改名以便与本文件的 update 方法区分
import { update as HostUpdate } from '@/runtime/host/update'
import type { CommandEvent } from '@/types/message'

/** git 探测的超时时间，和 release-channel.ts 取同一个量级：别让卡住的 git 冻死 bot */
const GIT_TIMEOUT_MS = 2000

/** 和宿主 `other/update.js` 的 `getLog()` 取同一个上限 */
const LOG_LIMIT = 100

/** 宿主 getLog 会跳过的合并提交前缀 */
const MERGE_SUBJECT = 'Merge branch'

/**
 * 读插件目录的 git 提交。
 *
 * 参数刻意和宿主 `other/update.js` 的 `getLog()` 保持一致
 * （`git log -100 --pretty="%h||[%cd] %s" --date=format:"%F %T"`，跳过 Merge branch），
 * 因为要出图的就是 `#更新日志` 那份数据。
 *
 * 没有直接调 `up.updateLog()`：那个方法内部 `this.reply(await this.getLog())` 自己就把
 * 消息发出去了，而 `getLog()` 的返回值是 `Bot.makeForwardArray(...)` 包好的转发消息，
 * 不是可以再拿来渲染的数据 —— 想取回列表就得去反解转发消息的结构，那个结构各适配器
 * 不一样。所以这里复刻同一条 git 命令，数据等价、不依赖消息形状。
 *
 * 失败返回 `null` 而不是空数组：调用方要能区分「不是 git 安装 / git 跑挂了」和
 * 「确实一条提交都没有」，前者该提示用户，后者只是空列表。
 */
const readGitCommits = (): Array<{ hash: string, date: string, subject: string }> | null => {
  try {
    const raw = execFileSync(
      'git',
      ['log', `-${LOG_LIMIT}`, '--pretty=%h||%ad||%s', '--date=format:%F %T'],
      {
        cwd: PluginPath,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: 1024 * 1024
      }
    )
    return raw
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        // subject 里可能自带 '||'，所以只切前两段，其余原样拼回去
        const [hash = '', date = '', ...rest] = line.split('||')
        return { hash, date, subject: rest.join('||') }
      })
      .filter(item => item.hash && item.subject && !item.subject.includes(MERGE_SUBJECT))
  } catch {
    return null
  }
}

/** 提交列表 -> `other/changelog` 要的 markdown */
const commitsToMarkdown = (commits: Array<{ hash: string, date: string, subject: string }>): string => {
  const lines: string[] = []
  let currentDate = ''
  for (const commit of commits) {
    const day = commit.date.split(' ')[0] ?? ''
    if (day !== currentDate) {
      currentDate = day
      lines.push('', `# ${day}`, '')
    }
    lines.push(`* \`${commit.hash}\` ${commit.subject}`)
  }
  return lines.join('\n').trim()
}

export class kkkUpdate extends plugin {
  constructor () {
    super({
      name: '更新',
      event: 'message',
      priority: 1000,
      rule: [
        {
          // 不再收「日志」：`#kkk更新日志` 归 help.ts 出 other/changelog 卡片，
          // 与上游一致。本文件优先级 1000 比 help 的 2000 靠前，两条规则重叠时
          // 这边先返回 true，卡片就永远进不去。
          reg: /^#kkk(插件)?(强制)?更新$/,
          fnc: 'update'
        },
        {
          // 更新日志放在这里而不是 help.ts：它读的是本插件目录的 git 提交，
          // 和「更新」是同一份数据来源，跟帮助页没有关系。
          reg: /^#?kkk更新日志$/,
          fnc: 'updateLog'
        }
      ]
    })
  }

  async update (e: CommandEvent): Promise<boolean> {
    // 更新是主人专属；非主人直接放行，让后面的插件有机会处理
    if (!e.isMaster) return false
    let msg = e.msg
    msg = msg.replace(/kkk(插件)?/, '')
    msg += Version.pluginName
    e.msg = msg
    const up = new HostUpdate(e)
    up.e = e
    up.update()
    return true
  }

  /**
   * `#kkk更新日志`：出插件目录 git 里的提交记录。
   *
   * 原来在 help.ts，渲染的是随包 CHANGELOG.md 最近十个版本 —— 那是发布说明，
   * 不是「这次更新拉到了什么」。用户装的是 `--depth=1` 的浅克隆，`git pull` 之后
   * 新提交就落在本地历史里，直接读 git 才是真正拉到的东西。
   */
  async updateLog (e: CommandEvent): Promise<boolean> {
    const commits = readGitCommits()
    if (commits === null) {
      await e.reply!('读取不到 git 提交记录。压缩包安装或插件目录不是 git 仓库时没有这份数据，可执行 #kkk版本 查看当前版本。')
      return true
    }
    if (commits.length === 0) {
      await e.reply!('git 里还没有可显示的提交记录。')
      return true
    }

    const img = await Render('other/changelog', {
      markdown: commitsToMarkdown(commits),
      // 这条命令只列本地 git 的提交，不联网比对版本，所以不进「更新提示」分支
      Tip: false,
      localVersion: Version.version,
      remoteVersion: Version.version
    })
    await e.reply!(img)
    return true
  }
}
