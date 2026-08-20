import fs from 'node:fs'
import path from 'node:path'

import { ClientPath, PluginPath } from '@/dir'

/**
 * 宿主 Yunzai 版本检查。
 *
 * `ktr/template/other/version_warning` 这个模板从初始移植（0471487）起就在仓库里，
 * 文案也已经改成 Yunzai 版（「插件建议的 Yunzai 运行环境版本」），但一直没有调用点。
 * 上游 karin-plugin-kkk 那边也没有渲染它的地方（它那份文案还是 karin 的），
 * 所以本文件是本仓库自己的实现，不是照搬。
 *
 * 最低版本写在插件 `package.json` 的 `engines.yunzai` 里，取的就是当前开发/测试
 * 所用宿主的版本号。npm / pnpm 只认 engines 里的 node 和 npm 两个键，
 * 多出来的 yunzai 不会影响安装。
 */

/** 版本号里能比较的部分：把 `>=3.1.3`、`v3.1.3-beta.1` 这类都归一成 [3,1,3] */
const parseVersion = (value: string | undefined): number[] | null => {
  const matched = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(value ?? ''))
  if (!matched) return null
  return [Number(matched[1]), Number(matched[2]), Number(matched[3] ?? 0)]
}

/**
 * 语义化比较。
 * @returns 负数表示 a 小于 b，0 表示相等，正数表示 a 大于 b
 */
const compareVersion = (a: number[], b: number[]): number => {
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** 读一个 package.json 的字段，读不到就返回 undefined，不抛 */
const readPackageField = <T>(file: string, pick: (pkg: Record<string, unknown>) => T): T | undefined => {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (typeof raw !== 'object' || raw === null) return undefined
    return pick(raw as Record<string, unknown>)
  } catch {
    return undefined
  }
}

/** 插件声明的最低宿主版本，形如 `>=3.1.3`；没声明返回 undefined */
export const getRequiredYunzaiVersion = (): string | undefined =>
  readPackageField(path.join(PluginPath, 'package.json'), pkg => {
    const engines = pkg.engines
    if (typeof engines !== 'object' || engines === null) return undefined
    const value = (engines as Record<string, unknown>).yunzai
    return typeof value === 'string' && value ? value : undefined
  })

/**
 * 宿主实际版本。
 *
 * 直接读 Yunzai 根目录的 package.json —— Miao-Yunzai 和 TRSS-Yunzai 都在那儿写
 * 自己的版本号，而适配器上报的版本是协议端（NapCat 之类）的，不是云崽的。
 */
export const getCurrentYunzaiVersion = (): string | undefined =>
  readPackageField(path.join(ClientPath, 'package.json'), pkg =>
    typeof pkg.version === 'string' && pkg.version ? pkg.version : undefined
  )

/**
 * 宿主版本是否低于插件声明的最低要求。
 *
 * 任何一边读不出版本号都返回 `null`：判断不了就别告警。压缩包安装、
 * 自己改过 package.json、非标准发行版都可能落到这一支，
 * 拿不准还硬弹一张「你该升级了」的卡片只会误导人。
 */
export const checkYunzaiVersion = (): { current: string, required: string } | null => {
  const requiredRaw = getRequiredYunzaiVersion()
  const currentRaw = getCurrentYunzaiVersion()
  if (!requiredRaw || !currentRaw) return null

  const required = parseVersion(requiredRaw)
  const current = parseVersion(currentRaw)
  if (!required || !current) return null

  return compareVersion(current, required) < 0
    ? { current: currentRaw, required: requiredRaw }
    : null
}
