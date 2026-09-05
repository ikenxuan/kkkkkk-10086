/**
 * 配置文件解析状态登记处。
 *
 * `Config` 每解析一份 yaml 就在这里登记结果，`#kkk版本` 的诊断卡据此列出「哪些配置
 * 正在退回默认值」。
 *
 * 为什么需要它：解析失败的 yaml 会被当成 `{}` 写进缓存，整份配置退化成默认值
 * （见 `Config.parseYamlRecordResult` 的说明），而 `initCfg()` 碰到这种文件只是
 * `continue`。不覆盖是刻意的 —— 补默认值等于清掉用户配置，见 `YamlReader.write`
 * 的 degraded 分支 —— 代价是它会一直坏着，现场只有启动时一行 error 一闪而过。
 * 用户看到的现象是「我明明配了却不生效」，最难往配置文件上想。
 *
 * 走诊断卡而不是启动时推给主人，理由同 `apps/help.ts` 里版本告警那处：启动推送会
 * 在每次重启刷屏，而且那条路要 Bot 和事件对象，配置加载期两样都没有
 * （`ErrorHandler/sender.ts` 的收件人是从 `ctx.event` 反查的）。
 *
 * 单独一个模块而不是挂在 Config 上：读它的诊断卡和测试都不用把真实 Config 拉进来。
 */
import { basename, dirname } from 'node:path'

/** 一份解析失败、因而整份退回默认值的配置文件 */
export interface DegradedConfigFile {
  /** 文件名，例如 `request.yaml` */
  file: string
  /** 所在目录名：`config` 是用户配置，`default_config` 是随插件发布的默认模板 */
  directory: string
  /** 解析失败的原因，已压成一行 */
  reason: string
}

/** 按绝对路径登记，同一个文件反复解析只留最后一次结果 */
const degradedFiles = new Map<string, DegradedConfigFile>()

/**
 * YAML 的报错自带源码片段和指示箭头，是多行的。诊断卡上这条原因只有一行的位置，
 * 整段塞进去会把后面的版式挤垮，所以只取第一行。
 */
const summarizeReason = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.split('\n')[0]?.trim() || '未知原因'
}

/**
 * 登记一次解析失败。
 * @param file 配置文件绝对路径
 * @param error 解析器抛出的错误
 */
export const recordConfigParseFailure = (file: string, error: unknown): void => {
  degradedFiles.set(file, {
    file: basename(file),
    directory: basename(dirname(file)),
    reason: summarizeReason(error)
  })
}

/**
 * 撤销一份文件的登记。
 *
 * 用户把文件改好之后 chokidar 会清掉那份缓存、下次读重新解析，这条就是那时候
 * 把它从名单里摘掉的地方 —— 否则诊断卡会一直挂着一个已经修好的告警。
 * @param file 配置文件绝对路径
 */
export const recordConfigParseSuccess = (file: string): void => {
  degradedFiles.delete(file)
}

/**
 * @returns 当前解析失败的配置文件，按文件名排序；全部正常时是空数组
 */
export const getDegradedConfigSnapshot = (): DegradedConfigFile[] =>
  [...degradedFiles.values()].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))

/** 仅供测试：清空登记 */
export const resetConfigHealth = (): void => {
  degradedFiles.clear()
}
