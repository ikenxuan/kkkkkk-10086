import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'

const data = neostandard({
  ignores: resolveIgnoresFromGitignore(),
  globals: {
    Bot: true,
    redis: true,
    logger: true,
    plugin: true,
    Renderer: true,
    segment: true,
    BILIBILIOBJECT: true
  },
  ts: false,
})

const newData = []

data.forEach(val => {
  val.rules['@stylistic/comma-dangle'] = ['error', 'never'] // 忽略逗号
  val.rules['camelcase'] = ['off'] // 忽略驼峰命名规则
  val.rules['eqeqeq'] = ['off'] // 忽略严格等于运算符
  val.rules['prefer-const'] = ['off'] // 忽略常量定义规则
  val.rules['arrow-body-style'] = 'off' // 忽略箭头函数规则
  newData.push(val)
})

export default newData