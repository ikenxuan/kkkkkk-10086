import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanTemplateBuild } from '../src/module/tooling/react-template/build-cleaner.ts'
import { parseTemplateToolCliArguments } from '../src/module/tooling/react-template/cli-options.ts'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { root } = parseTemplateToolCliArguments(process.argv.slice(2), repositoryRoot)

const result = cleanTemplateBuild(root)
console.log(`已清理模板构建产物：${result.root}`)
