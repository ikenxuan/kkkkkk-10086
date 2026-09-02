import { DEFAULT_REQUEST_TIMEOUT_MS, runWithRequestGuard } from './RequestGuard.js';
const DEFAULT_CONCURRENCY = 2;
export class ParseScheduler {
    concurrency;
    timeoutMs;
    onState;
    queue = [];
    pending = new Map();
    runningFingerprints = new Set();
    running = 0;
    constructor(options = {}) {
        const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
        if (!Number.isInteger(concurrency) || concurrency < 1) {
            throw new RangeError('concurrency must be a positive integer');
        }
        const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
            throw new RangeError('timeoutMs must be a finite number greater than zero');
        }
        this.concurrency = concurrency;
        this.timeoutMs = timeoutMs;
        this.onState = options.onState;
    }
    submit(fingerprint, task) {
        const duplicate = this.pending.get(fingerprint);
        if (duplicate !== undefined) {
            this.emit({ fingerprint, state: 'deduplicated' });
            return duplicate.promise;
        }
        let resolveTask;
        let rejectTask;
        const promise = new Promise((resolve, reject) => {
            resolveTask = resolve;
            rejectTask = reject;
        });
        const pendingTask = {
            fingerprint,
            task,
            promise,
            resolve: resolveTask,
            reject: rejectTask,
            state: 'queued'
        };
        this.pending.set(fingerprint, pendingTask);
        this.queue.push(pendingTask);
        this.emit({ fingerprint, state: 'queued' });
        this.drain();
        return promise;
    }
    getSnapshot() {
        return {
            concurrency: this.concurrency,
            running: this.running,
            queued: this.queue.length,
            pending: this.pending.size,
            runningFingerprints: [...this.runningFingerprints],
            queuedFingerprints: this.queue.map(task => task.fingerprint)
        };
    }
    drain() {
        while (this.running < this.concurrency) {
            const task = this.queue.shift();
            if (task === undefined)
                return;
            this.start(task);
        }
    }
    start(task) {
        task.state = 'running';
        this.running += 1;
        this.runningFingerprints.add(task.fingerprint);
        this.emit({ fingerprint: task.fingerprint, state: 'running' });
        Promise.resolve()
            .then(() => runWithRequestGuard(signal => task.task(signal), { timeoutMs: this.timeoutMs, maxRetries: 0 }))
            .then(result => this.succeed(task, result), error => this.fail(task, error));
    }
    succeed(task, result) {
        this.release(task);
        this.emit({
            fingerprint: task.fingerprint,
            state: 'succeeded',
            result
        });
        task.resolve(result);
        this.drain();
    }
    fail(task, error) {
        this.release(task);
        this.emit({
            fingerprint: task.fingerprint,
            state: 'failed',
            error
        });
        task.reject(error);
        this.drain();
    }
    release(task) {
        this.running -= 1;
        this.runningFingerprints.delete(task.fingerprint);
        if (this.pending.get(task.fingerprint) === task) {
            this.pending.delete(task.fingerprint);
        }
    }
    emit(payload) {
        if (this.onState === undefined)
            return;
        try {
            this.onState({
                ...payload,
                snapshot: this.getSnapshot()
            });
        }
        catch {
            // 诊断回调不能影响解析队列本身。
        }
    }
}
