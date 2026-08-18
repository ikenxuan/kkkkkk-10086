import globalsPackage from 'globals'
import neostandard from 'neostandard'

const ignores = [
  'lib/**',
  'node_modules/**',
  'data/**',
  'config/config/**'
]

const globals = {
  ...globalsPackage.node,
  Bot: 'readonly',
  redis: 'readonly',
  plugin: 'readonly',
  segment: 'readonly',
  logger: 'readonly'
}

const standardConfig = neostandard({ ts: true, globals, ignores })
const legacyRuleEntries = standardConfig.filter(config =>
  Object.keys(config.rules ?? {}).length > 0 &&
  !config.files?.some(pattern => pattern.includes('.ts')) &&
  !config.ignores?.some(pattern => pattern.includes('*.js'))
)
const legacyPlugins = Object.assign(
  {},
  ...legacyRuleEntries.map(config => config.plugins ?? {})
)
const legacyRules = Object.fromEntries(
  legacyRuleEntries
    .flatMap(config => Object.entries(config.rules ?? {}))
    .map(([name, setting]) => {
      const severity = Array.isArray(setting) ? setting[0] : setting
      if (severity === 0 || severity === 'off') return [name, 'off']
      return [name, ['warn', ...(Array.isArray(setting) ? setting.slice(1) : [])]]
    })
)

export default [
  ...neostandard({ ts: true, globals, ignores }),
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    rules: {
      camelcase: 'off',
      eqeqeq: 'off',
      'prefer-const': 'off',
      'comma-dangle': ['warn', 'never'],
      'arrow-body-style': 'off',
      indent: ['warn', 2, { SwitchCase: 1 }],
      'space-before-function-paren': 'warn',
      semi: ['warn', 'never'],
      'no-trailing-spaces': 'warn',
      'object-curly-spacing': ['warn', 'always']
    }
  },
  {
    files: [
      'tests/**/*.{js,mjs,cjs}',
      '*.{js,mjs,cjs}'
    ],
    plugins: legacyPlugins,
    rules: legacyRules
  }
]
