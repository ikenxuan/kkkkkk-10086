import { AsyncLocalStorage } from 'node:async_hooks';
import { format } from 'node:util';
const storage = new AsyncLocalStorage();
const hookedLoggers = new WeakSet();
const hookMarker = Symbol.for('kkkkkk-10086.log-context-hook');
const loggerMethods = [
    { name: 'trace', level: 'TRAC' },
    { name: 'debug', level: 'DEBU' },
    { name: 'mark', level: 'MARK' },
    { name: 'info', level: 'INFO' },
    { name: 'warn', level: 'WARN' },
    { name: 'error', level: 'ERRO' },
    { name: 'fatal', level: 'FATA' }
];
const getHostLogger = () => {
    const globalWithLogger = globalThis;
    return globalWithLogger.logger;
};
const formatTimestamp = (date = new Date()) => {
    const pad = (value, width = 2) => String(value).padStart(width, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};
const formatArguments = (args) => {
    try {
        return format(...args);
    }
    catch {
        return args.map(value => {
            try {
                return String(value);
            }
            catch {
                return '[Unprintable value]';
            }
        }).join(' ');
    }
};
const appendLog = (level, args) => {
    const context = storage.getStore();
    if (!context?.active || context.entries.length >= context.maxEntries)
        return;
    try {
        const message = formatArguments(args);
        const raw = `[${formatTimestamp()}][${level}] ${message}`;
        const bytes = Buffer.byteLength(raw, 'utf8');
        if (context.bytes + bytes > context.maxBytes)
            return;
        context.entries.push({ timestamp: raw.slice(1, 13), level, message, raw });
        context.bytes += bytes;
    }
    catch {
        // Logging capture must never replace or mask the business error.
    }
};
const installHostLoggerHook = () => {
    const hostLogger = getHostLogger();
    if (!hostLogger || hookedLoggers.has(hostLogger))
        return;
    for (const { name, level } of loggerMethods) {
        const original = hostLogger[name];
        if (typeof original !== 'function')
            continue;
        if (original[hookMarker])
            continue;
        const wrapped = function (...args) {
            let result;
            try {
                result = Reflect.apply(original, this, args);
            }
            finally {
                appendLog(level, args);
            }
            return result;
        };
        Object.defineProperty(wrapped, hookMarker, { value: true });
        try {
            hostLogger[name] = wrapped;
        }
        catch {
            // Some host versions expose a non-writable logger method.
        }
    }
    hookedLoggers.add(hostLogger);
};
export const createLogContext = (options = {}) => {
    installHostLoggerHook();
    const state = {
        active: true,
        entries: [],
        maxEntries: Math.max(1, options.maxEntries ?? 200),
        maxBytes: Math.max(1024, options.maxBytes ?? 64 * 1024),
        bytes: 0
    };
    return {
        run: (fn) => storage.run(state, fn),
        logs: () => state.entries.slice(),
        destroy: () => {
            state.active = false;
        }
    };
};
export const parseLogsToStructured = (logs) => {
    const logRegex = /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\[([A-Z]{4})\]\s([\s\S]*)$/;
    return logs.map(log => {
        if (typeof log !== 'string')
            return log;
        const match = log.match(logRegex);
        if (!match) {
            return { timestamp: '', level: 'INFO', message: log, raw: log };
        }
        return {
            timestamp: match[1] ?? '',
            level: match[2],
            message: match[3] ?? '',
            raw: log
        };
    }).filter(log => log.level !== 'TRAC');
};
