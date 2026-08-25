import { isRecord } from './record.js';
/** A guarded request is allowed one initial attempt and this many retries by default. */
export const DEFAULT_REQUEST_MAX_RETRIES = 2;
/** Every individual attempt is forcefully released after one minute by default. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_BACKOFF_BASE_MS = 250;
const DEFAULT_BACKOFF_MAX_MS = 5_000;
const RETRYABLE_NETWORK_CODES = new Set([
    'EAI_AGAIN',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTDOWN',
    'EHOSTUNREACH',
    'ENETDOWN',
    'ENETRESET',
    'ENETUNREACH',
    'ENOTFOUND',
    'EPIPE',
    'ESOCKETTIMEDOUT',
    'ETIMEDOUT',
    'ERR_NETWORK',
    'UND_ERR_BODY_TIMEOUT',
    'UND_ERR_CONNECT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_SOCKET'
]);
/** A stable, identifiable error emitted when one guarded attempt exceeds its deadline. */
export class RequestTimeoutError extends Error {
    code = 'ERR_REQUEST_TIMEOUT';
    timeoutMs;
    constructor(timeoutMs) {
        super(`Request timed out after ${timeoutMs}ms`);
        this.name = 'RequestTimeoutError';
        this.timeoutMs = timeoutMs;
    }
}
/**
 * Returns true only for failures that clearly represent a transport/network timeout.
 * In particular, an HTTP 4xx response always wins over a network-like error code so
 * malformed/auth/business requests cannot be amplified by retries.
 */
export const isRetryableRequestError = (error) => {
    if (error instanceof RequestTimeoutError)
        return true;
    const status = getHttpStatus(error);
    if (status === 408 || status === 429 || (status !== undefined && status >= 500 && status < 600))
        return true;
    if (status !== undefined && status >= 400 && status < 500)
        return false;
    if (!isRecord(error))
        return false;
    const code = typeof error.code === 'string' ? error.code.toUpperCase() : '';
    if (RETRYABLE_NETWORK_CODES.has(code))
        return true;
    const name = typeof error.name === 'string' ? error.name : '';
    if (name === 'TimeoutError' || name === 'NetworkError')
        return true;
    const cause = error.cause;
    return cause !== undefined && cause !== error && isRetryableRequestError(cause);
};
/**
 * Runs an abort-aware request task with a per-attempt hard deadline and conservative
 * retry policy. All controller/timer state is local to this invocation, so one failed
 * guard cannot cancel or otherwise interfere with a parallel guard.
 */
export async function runWithRequestGuard(task, options = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const maxRetries = options.maxRetries ?? DEFAULT_REQUEST_MAX_RETRIES;
    validateOptions(timeoutMs, maxRetries);
    const backoff = options.backoff ?? defaultBackoff;
    const sleep = options.sleep ?? defaultSleep;
    throwIfExternallyAborted(options.signal);
    for (let attempt = 0;; attempt++) {
        try {
            return await runAttempt(task, timeoutMs, options.signal);
        }
        catch (error) {
            // The caller's cancellation always has priority over timeout/network errors.
            throwIfExternallyAborted(options.signal);
            if (attempt >= maxRetries || !isRetryableRequestError(error))
                throw error;
            const retryNumber = attempt + 1;
            const delayMs = backoff(retryNumber, error);
            if (!Number.isFinite(delayMs) || delayMs < 0) {
                throw new RangeError('RequestGuard backoff must return a finite, non-negative delay');
            }
            await sleepWithCancellation(delayMs, sleep, options.signal);
        }
    }
}
const runAttempt = async (task, timeoutMs, externalSignal) => {
    throwIfExternallyAborted(externalSignal);
    const controller = new AbortController();
    let terminalCause;
    let timeoutError;
    let externalReason;
    let removeExternalListener = () => { };
    const timeoutPromise = new Promise((_resolve, reject) => {
        const timeoutId = setTimeout(() => {
            if (terminalCause !== undefined)
                return;
            terminalCause = 'timeout';
            timeoutError = new RequestTimeoutError(timeoutMs);
            controller.abort(timeoutError);
            reject(timeoutError);
        }, timeoutMs);
        removeExternalListener = () => {
            clearTimeout(timeoutId);
        };
    });
    let externalAbortPromise;
    if (externalSignal) {
        externalAbortPromise = new Promise((_resolve, reject) => {
            const onAbort = () => {
                if (terminalCause !== undefined)
                    return;
                terminalCause = 'external';
                externalReason = getAbortReason(externalSignal);
                controller.abort(externalReason);
                reject(externalReason);
            };
            const clearTimeoutOnly = removeExternalListener;
            removeExternalListener = () => {
                clearTimeoutOnly();
                externalSignal.removeEventListener('abort', onAbort);
            };
            if (externalSignal.aborted)
                onAbort();
            else
                externalSignal.addEventListener('abort', onAbort, { once: true });
        });
    }
    let taskPromise;
    try {
        taskPromise = Promise.resolve(task(controller.signal));
    }
    catch (error) {
        taskPromise = Promise.reject(error);
    }
    const normalizedTaskPromise = taskPromise.catch((error) => {
        if (terminalCause === 'timeout')
            throw timeoutError;
        if (terminalCause === 'external')
            throw externalReason;
        throw error;
    });
    try {
        return await Promise.race([
            normalizedTaskPromise,
            timeoutPromise,
            ...(externalAbortPromise ? [externalAbortPromise] : [])
        ]);
    }
    finally {
        removeExternalListener();
    }
};
const sleepWithCancellation = async (delayMs, sleep, externalSignal) => {
    throwIfExternallyAborted(externalSignal);
    const controller = new AbortController();
    let externallyAborted = false;
    let externalReason;
    let removeExternalListener = () => { };
    let externalAbortPromise;
    if (externalSignal) {
        externalAbortPromise = new Promise((_resolve, reject) => {
            const onAbort = () => {
                if (externallyAborted)
                    return;
                externallyAborted = true;
                externalReason = getAbortReason(externalSignal);
                controller.abort(externalReason);
                reject(externalReason);
            };
            removeExternalListener = () => {
                externalSignal.removeEventListener('abort', onAbort);
            };
            if (externalSignal.aborted)
                onAbort();
            else
                externalSignal.addEventListener('abort', onAbort, { once: true });
        });
    }
    let sleepPromise;
    try {
        sleepPromise = Promise.resolve(sleep(delayMs, controller.signal));
    }
    catch (error) {
        sleepPromise = Promise.reject(error);
    }
    const normalizedSleepPromise = sleepPromise.catch((error) => {
        if (externallyAborted)
            throw externalReason;
        throw error;
    });
    try {
        await Promise.race([
            normalizedSleepPromise,
            ...(externalAbortPromise ? [externalAbortPromise] : [])
        ]);
    }
    finally {
        removeExternalListener();
    }
};
const defaultBackoff = (retryNumber) => Math.min(DEFAULT_BACKOFF_MAX_MS, DEFAULT_BACKOFF_BASE_MS * 2 ** (retryNumber - 1));
const defaultSleep = async (delayMs, signal) => {
    await new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(getAbortReason(signal));
            return;
        }
        const onAbort = () => {
            clearTimeout(timeoutId);
            reject(getAbortReason(signal));
        };
        const timeoutId = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, delayMs);
        signal.addEventListener('abort', onAbort, { once: true });
    });
};
const validateOptions = (timeoutMs, maxRetries) => {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new RangeError('RequestGuard timeoutMs must be a finite number greater than zero');
    }
    if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) {
        throw new RangeError('RequestGuard maxRetries must be a non-negative safe integer');
    }
};
const throwIfExternallyAborted = (signal) => {
    if (signal?.aborted)
        throw getAbortReason(signal);
};
const getAbortReason = (signal) => {
    if (signal.reason !== undefined)
        return signal.reason;
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    return error;
};
const getHttpStatus = (error) => {
    if (!isRecord(error))
        return undefined;
    if (typeof error.status === 'number')
        return error.status;
    if (isRecord(error.response) && typeof error.response.status === 'number') {
        return error.response.status;
    }
    return undefined;
};
