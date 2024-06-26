import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'

const data = neostandard({
  ignores: resolveIgnoresFromGitignore(),
  globals: [],
  ts: false,
})

const newData = []

data.forEach(val => {
  val.rules['@stylistic/comma-dangle'] = ['off', 'never']
  val.rules['camelcase'] = ['off']
  val.rules['eqeqeq'] = ['off']
  newData.push(val)
})

export default newData
