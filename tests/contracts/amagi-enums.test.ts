import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import { fallbackAmagiRuntime } from '../../src/module/platform/bilibili/amagi-runtime.js'

/**
 * amagi 枚举的契约基线。
 *
 * 本仓库有三处按名字读 amagi 的枚举常量（`DynamicType` / `MajorType` /
 * `AdditionalType`），全部走 `require(...) as <手写接口>`。那个 `as` 是断言、
 * 不是校验：上游把 `LIVE_RCMD` 改个名，`require` 照样成功、类型检查照样全绿，
 * 运行时拿到的是 `undefined`，而 `undefined === item.type` 永远为假 ——
 * 于是对应的那类动态从推送里静默消失，日志上一个字都没有。
 *
 * `push.ts` 还有一份手写的兜底副本（amagi 装不上时用），同样没有任何编译期约束。
 *
 * 所以这里做两件事，两件都拿真包当唯一事实来源：
 *
 * 1. 兜底副本与真包逐键相等，且覆盖 `push.ts` 实际读到的全部成员；
 * 2. 全仓库读到的每个成员，在真包里都真实存在。
 *
 * 读取清单不手写，直接扫源码得出 —— 手写清单迟早和代码脱节，而这个测试存在的
 * 意义就是拦住脱节。
 */

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const sourceRoot = join(repoRoot, 'src')

/** 递归列出 `src` 下的 .ts/.tsx。不用 readdirSync 的 recursive 选项，那个在旧 Node 上没有。 */
const listSourceFiles = (directory: string): string[] => {
  const found: string[] = []
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) {
      found.push(...listSourceFiles(full))
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      found.push(full)
    }
  }
  return found
}

/**
 * 扫出 `<枚举>.<成员>` 形式的读取点。
 *
 * 只认全大写成员名：`DynamicType` 这类标识符本身也会出现在 import、类型标注和
 * 注释里（`Record<string, string>`、`@param {DynamicType}`），而真正的取值一定是
 * 大写下划线的常量名。
 */
const ENUM_READ_PATTERN = /\b(DynamicType|MajorType|AdditionalType)\.([A-Z][A-Z0-9_]*)\b/g

interface EnumRead {
  enumName: string
  member: string
  file: string
}

const collectEnumReads = (files: string[]): EnumRead[] => {
  const reads: EnumRead[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(ENUM_READ_PATTERN)) {
      reads.push({
        enumName: match[1] as string,
        member: match[2] as string,
        file: relative(repoRoot, file).replace(/\\/g, '/')
      })
    }
  }
  return reads
}

const sourceFiles = listSourceFiles(sourceRoot)
const enumReads = collectEnumReads(sourceFiles)

/**
 * 真包，直接 require，不经过被测代码自己的加载器。
 *
 * 用被测代码的 `loadAmagiRuntime()` 会毁掉这个测试：amagi 缺失时它返回兜底副本，
 * 「副本 == 副本」永远成立。这里拿不到真包就让测试直接失败 —— amagi 是
 * dependencies 里的运行时依赖，装不上本身就是要修的事。
 *
 * 裸 `require('@ikenxuan/amagi')` 在 vitest 里解析到 amagi 的开发入口
 * `src/index.ts`（发布包里没有这个文件），所以照 `bilibili.ts` 的路子，
 * 从稳定导出的 `axios` 子路径反推 CJS 产物。
 */
const require = createRequire(import.meta.url)
const loadUpstreamAmagi = (): Record<string, Record<string, string> | undefined> => {
  const axiosEntry = require.resolve('@ikenxuan/amagi/axios')
  return require(resolve(axiosEntry, '../../default/index.cjs')) as Record<string, Record<string, string> | undefined>
}
const amagi = loadUpstreamAmagi()

/** 真包里某个枚举的成员表，枚举本身缺失时给出可读的失败信息 */
const upstreamEnum = (enumName: string): Record<string, string> => {
  const table = amagi[enumName]
  expect(table, `@ikenxuan/amagi 没有导出 ${enumName}`).toBeTypeOf('object')
  return table as Record<string, string>
}

describe('amagi 枚举兜底副本与真包对齐', () => {
  it('DynamicType 的兜底副本与真包逐键相等', () => {
    const upstream = upstreamEnum('DynamicType')
    for (const [member, value] of Object.entries(fallbackAmagiRuntime.DynamicType)) {
      expect(upstream[member], `DynamicType.${member} 在真包里的取值变了或成员被改名`).toBe(value)
    }
  })

  it('MajorType 的兜底副本与真包逐键相等', () => {
    const upstream = upstreamEnum('MajorType')
    for (const [member, value] of Object.entries(fallbackAmagiRuntime.MajorType)) {
      expect(upstream[member], `MajorType.${member} 在真包里的取值变了或成员被改名`).toBe(value)
    }
  })

  it('push.ts 读到的每个成员都在兜底副本里', () => {
    // 漏一个成员，装不上 amagi 的用户那里就是 `undefined`，对应动态静默丢失
    const pushReads = enumReads.filter(read => read.file === 'src/module/platform/bilibili/push.ts')
    expect(pushReads.length, '没扫到 push.ts 的枚举读取点，正则或文件路径需要更新').toBeGreaterThan(0)

    for (const { enumName, member } of pushReads) {
      const table = (fallbackAmagiRuntime as unknown as Record<string, Record<string, string>>)[enumName]
      expect(table, `兜底副本没有 ${enumName}，而 push.ts 读了它`).toBeTypeOf('object')
      expect(
        Object.keys(table as Record<string, string>),
        `push.ts 读了 ${enumName}.${member}，兜底副本里却没有这一项`
      ).toContain(member)
    }
  })
})

describe('全仓库读到的 amagi 枚举成员都真实存在', () => {
  it('扫到了枚举读取点', () => {
    // 正则失效时上面那些遍历会退化成空循环、静默全绿，所以先钉住扫描本身有效
    expect(enumReads.length).toBeGreaterThan(0)
    expect(new Set(enumReads.map(read => read.enumName))).toEqual(
      new Set(['DynamicType', 'MajorType', 'AdditionalType'])
    )
  })

  it('每个成员在真包里都有非空字符串取值', () => {
    for (const { enumName, member, file } of enumReads) {
      const upstream = upstreamEnum(enumName)
      expect(
        upstream[member],
        `${file} 读了 ${enumName}.${member}，真包里没有这一项（上游改名了）`
      ).toBeTypeOf('string')
      expect(upstream[member]).not.toBe('')
    }
  })
})
