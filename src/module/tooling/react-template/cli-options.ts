import { resolve } from 'node:path'

export interface TemplateToolCliArguments {
  root: string
  check: boolean
}

export interface TemplateToolCliParserOptions {
  allowCheck?: boolean
}

export const parseTemplateToolCliArguments = (
  args: readonly string[],
  defaultRoot: string,
  options: TemplateToolCliParserOptions = {}
): TemplateToolCliArguments => {
  if (!defaultRoot.trim()) throw new Error('默认根目录不能为空')

  let root = resolve(defaultRoot)
  let check = false
  let hasRoot = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === '--root') {
      if (hasRoot) throw new Error('--root 不能重复')
      const value = args[index + 1]
      if (!value?.trim() || value.startsWith('--')) {
        throw new Error('--root 需要一个目录参数')
      }
      root = resolve(value)
      hasRoot = true
      index += 1
      continue
    }

    if (argument === '--check' && options.allowCheck) {
      if (check) throw new Error('--check 不能重复')
      check = true
      continue
    }

    throw new Error(`未知参数：${argument}`)
  }

  return { root, check }
}
