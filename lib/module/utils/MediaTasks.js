import { runWithRequestGuard } from './RequestGuard.js';
export const runMediaTasks = async (tasks, options = {}) => {
    const entries = [];
    if (tasks.poster)
        entries.push(['poster', tasks.poster]);
    if (tasks.video)
        entries.push(['video', tasks.video]);
    const settled = await Promise.allSettled(entries.map(([, task]) => runWithRequestGuard(() => Promise.resolve().then(task), { timeoutMs: options.timeoutMs, maxRetries: 0 })));
    const result = {
        succeeded: [],
        failures: []
    };
    settled.forEach((taskResult, index) => {
        const entry = entries[index];
        if (!entry)
            throw new Error('Media task result has no matching task');
        const task = entry[0];
        if (taskResult.status === 'fulfilled') {
            result.succeeded.push(task);
            return;
        }
        const failure = { task, error: taskResult.reason };
        result.failures.push(failure);
        options.onTaskFailure?.(failure);
    });
    if (entries.length > 0 && result.failures.length === entries.length) {
        throw new AggregateError(result.failures.map(failure => failure.error), 'All enabled media tasks failed');
    }
    return result;
};
