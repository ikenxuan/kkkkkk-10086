/**
 * 锅巴（Guoba-Plugin）面板入口。
 *
 * 仓库根的 `guoba.support.js` 只做一句 `export * from './lib/guoba.support.js'`，
 * 锅巴靠那条路径发现插件，所以本文件的位置和文件名都不能动。
 *
 * 这里只留三件事：按顺序拼装各配置节的 schema、把面板数据读出来、把面板改动写回
 * 对应的 yaml。表单本身拆在 src/module/guoba/ 下——helpers.ts 是控件构造器，
 * shared.ts 是跨节复用的候选项与片段，schemas/ 下一个面板分组一个文件。
 *
 * 这条路径是锅巴在框架启动后单独加载的，只能读写配置：一旦顺带初始化数据库、
 * 加载 app 或启动 API 服务，面板一打开就会重复执行插件的启动副作用。
 */
import * as sections from './module/guoba/schemas/index.js'
import Config from './module/utils/Config.js'

import type { ConfigName } from './types/config.js'
import type { GuobaSchema, GuobaSupport } from './types/guoba.js'
import { isRecord as isPlainRecord } from './module/utils/record.js'

/** 锅巴只允许写入 `getConfigData()` 暴露的九个配置域。 */
const CONFIG_NAMES = [
  'app', 'bilibili', 'cookies', 'douyin', 'kuaishou',
  'pushlist', 'request', 'upload', 'xiaohongshu'
] as const satisfies readonly ConfigName[]

const isConfigName = (name: string): name is ConfigName =>
  CONFIG_NAMES.some(configName => configName === name)

/**
 * 面板分组的先后顺序。
 *
 * 每个配置节文件自带 SOFT_GROUP_BEGIN，所以这个数组的顺序就是用户在面板上看到的
 * 分组顺序；`flat()` 之后必须与拆分前逐项一致，顺序变了等于把用户熟悉的面板重排。
 */
const schemas: GuobaSchema[] = [
  sections.basic,
  sections.douyin,
  sections.bilibili,
  sections.kuaishou,
  sections.xiaohongshu,
  sections.upload,
  sections.request
].flat()

export function supportGuoba (): GuobaSupport {
  return {
    pluginInfo: {
      name: 'kkkkkk-10086',
      title: 'kkkkkk-10086',
      author: '@ikenxuan',
      authorLink: 'https://gitee.com/ikenxuan',
      link: 'https://gitee.com/ikenxuan/kkkkkk-10086',
      isV3: true,
      isV2: false,
      description: '视频解析与推送配置已迁移到锅巴面板',
      icon: 'svg-spinners:blocks-shuffle-3',
      iconColor: '#00c3ff'
    },
    configInfo: {
      schemas,
      getConfigData () {
        return {
          cookies: Config.cookies,
          app: Config.app,
          douyin: Config.douyin,
          bilibili: Config.bilibili,
          pushlist: Config.pushlist,
          kuaishou: Config.kuaishou,
          xiaohongshu: Config.xiaohongshu,
          upload: Config.upload,
          request: Config.request
        }
      },
      async setConfigData (data, { Result }) {
        try {
          const touched = new Set<string>()
          const entries: Array<[string, unknown]> = Object.entries(data || {})

          for (const [key, value] of entries) {
            if (!key) continue

            if (!key.includes('.') && isPlainRecord(value)) {
              if (!isConfigName(key)) throw new Error(`未知配置域: ${key}`)
              if (!Config.ModifyPro(key, value)) throw new Error(`配置写入失败: ${key}`)
              touched.add(key)
              continue
            }

            const [filename, ...parts] = key.split('.')
            if (!filename || parts.length === 0) continue
            if (!isConfigName(filename)) throw new Error(`未知配置域: ${filename}`)
            // 点分键（cookies.bilibili 这类）走这条。必须看返回值：用户 yaml 解析失败时
            // YamlReader 会拒写以保护原文件，丢掉返回值就会在一个字都没落盘的情况下
            // 回「保存成功」—— 面板显示存好了、磁盘没动，正是「设了 ck 却说未配置」的来源。
            // 上面 ModifyPro 那支本来就是这么判的，两条路径口径对齐。
            if (!Config.modify(filename, parts.join('.'), value)) {
              throw new Error(`配置写入失败: ${key}（${filename}.yaml 可能存在语法错误，已拒绝写入以避免清空原文件）`)
            }
            touched.add(filename)
          }

          if (touched.has('pushlist')) await Config.syncConfigToDatabase()
          return Result.ok({}, '保存成功')
        } catch (error) {
          logger.error('设置配置数据失败:', error)
          return Result.error('保存失败', error)
        }
      }
    }
  }
}
