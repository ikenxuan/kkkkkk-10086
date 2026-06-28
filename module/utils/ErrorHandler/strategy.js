const strategies = []

/**
 * 注册业务错误处理策略。
 * @param {{name: string, match: Function, handle: Function}} strategy 错误策略
 */
export const registerErrorStrategy = (strategy) => {
  if (!strategy?.name || typeof strategy.match !== 'function' || typeof strategy.handle !== 'function') {
    throw new TypeError('错误处理策略必须包含 name、match 和 handle')
  }

  const index = strategies.findIndex(item => item.name === strategy.name)
  if (index >= 0) strategies.splice(index, 1, strategy)
  else strategies.push(strategy)
}

export const getStrategies = () => [...strategies]
