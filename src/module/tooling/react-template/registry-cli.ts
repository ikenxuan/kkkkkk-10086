import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseTemplateToolCliArguments } from './cli-options.ts'
import {
  checkTemplateRegistry,
  syncTemplateRegistry
} from './registry-generator.ts'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const { root, check } = parseTemplateToolCliArguments(
  process.argv.slice(2),
  repositoryRoot,
  { allowCheck: true }
)

if (check) {
  const result = checkTemplateRegistry(root)
  if (result.status === 'stale') {
    console.error(`模板注册表已过期：${result.outputFile}`)
    process.exitCode = 1
  } else {
    console.log(`模板注册表有效：${result.entryCount} 个路由 -> ${result.outputFile}`)
  }
} else {
  const result = syncTemplateRegistry(root)
  console.log(`生成 React 模板注册表：${result.entryCount} 个路由 -> ${result.outputFile}`)
}
