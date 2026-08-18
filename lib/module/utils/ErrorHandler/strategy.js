const strategies = [];
export const registerErrorStrategy = (strategy) => {
    if (!strategy?.name || typeof strategy.match !== 'function' || typeof strategy.handle !== 'function') {
        throw new TypeError('错误处理策略必须包含 name、match 和 handle');
    }
    const index = strategies.findIndex(item => item.name === strategy.name);
    if (index >= 0)
        strategies.splice(index, 1, strategy);
    else
        strategies.push(strategy);
};
export const getStrategies = () => [...strategies];
