import globals from 'globals'

export default [{
  languageOptions: {
    globals: {
      ...globals.node
    }
  },

  rules: {
    'camelcase': ['off'],
    'eqeqeq': ['off'],
    'prefer-const': ['off'],
    'comma-dangle': [2, 'never'],
    'arrow-body-style': 'off',
    'default-case': 2,
    'indent': ['error', 2, { "SwitchCase": 1 }],
    'space-before-function-paren': 1
  }
}]