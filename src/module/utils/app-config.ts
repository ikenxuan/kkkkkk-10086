import type { AppConfig } from '@/types/config'

/**
 * `app.yaml` 里那几个新旧同义键的读取规则。
 *
 * 单独一个文件、不进 `utils/index` 的桶：`apps/*.ts` 的单测普遍用
 * `vi.mock('utils/index.js')` 把整个桶换成手写字面量，往桶里加导出会让
 * 二十来个 mock 工厂同时缺项、在 import 期就炸。这里没有任何副作用、
 * 也不反向依赖 `Config`，所以各处直接 `@/module/utils/app-config` 引入即可，
 * 与 `utils/record` 同一个路子。
 */

/** 新键缺失时退到旧键；两个都没配才是 undefined */
export const getConfigValue = <T>(value: T | undefined, fallback: T | undefined): T | undefined => value ?? fallback

/** 视频解析总开关，`videoTool`（新）优先于 `videotool`（旧），只有显式 false 才算关 */
export const isVideoToolEnabled = (app: AppConfig | undefined): boolean =>
  getConfigValue(app?.videoTool, app?.videotool) !== false

/**
 * 是否抢最高优先级（`-Infinity`）。
 *
 * 两个 app 必须同口径：`kkkTools` 一直读 `defaulttool` 并在缺失时退到 `videoTool`，
 * 而 `kkkPush` 原来裸读 `Config.app.defaulttool`。用户配置里没有 `defaulttool`
 * 这一行时（浅合并只补顶层，写了 `app:` 就可能整键丢失），前者判 `-Infinity`、
 * 后者落到数值优先级，两个 app 的派发次序就此分叉。
 */
export const isDefaultTool = (app: AppConfig | undefined): boolean =>
  getConfigValue(app?.defaulttool, app?.videoTool) !== false
