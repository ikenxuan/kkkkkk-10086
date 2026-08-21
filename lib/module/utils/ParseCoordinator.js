import { ParseScheduler } from './ParseScheduler.js';
const FINGERPRINT_VERSION = 'parse:v1:';
const requiredText = (value, label) => {
    const normalized = String(value).trim();
    if (normalized.length === 0) {
        throw new TypeError(`${label} must not be empty`);
    }
    return normalized;
};
const normalizePlatform = (platform) => (requiredText(platform, 'platform').toLowerCase());
const normalizeUrl = (value) => {
    const source = requiredText(value, 'target URL');
    let url;
    try {
        url = new URL(source);
    }
    catch {
        throw new TypeError('target URL must be an absolute HTTP or HTTPS URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new TypeError('target URL must use HTTP or HTTPS');
    }
    url.hash = '';
    url.searchParams.sort();
    return url.href;
};
const normalizeTarget = (target) => {
    if (target.type === 'url') {
        return [target.type, normalizeUrl(target.value)];
    }
    if (target.type === 'work-id') {
        return [target.type, requiredText(target.value, 'work ID')];
    }
    throw new TypeError('target type must be url or work-id');
};
const normalizeScope = (scope) => {
    if (scope.type !== 'group' && scope.type !== 'private') {
        throw new TypeError('scope type must be group or private');
    }
    return [scope.type, requiredText(scope.id, 'scope ID')];
};
export const createParseFingerprint = (identity) => {
    const normalized = [
        normalizePlatform(identity.platform),
        ...normalizeTarget(identity.target),
        ...normalizeScope(identity.scope)
    ];
    return `${FINGERPRINT_VERSION}${JSON.stringify(normalized)}`;
};
const ignoreReactionFailure = () => { };
const notifyReaction = (port, state) => {
    if (port === undefined)
        return;
    try {
        Promise.resolve(port.setState(state)).catch(ignoreReactionFailure);
    }
    catch {
        // Reactions are status hints; the in-memory scheduler remains authoritative.
    }
};
export class ParseCoordinator {
    scheduler;
    constructor(options = {}) {
        this.scheduler = new ParseScheduler({ concurrency: options.concurrency });
    }
    submit(identity, task, reaction) {
        const fingerprint = createParseFingerprint(identity);
        return this.scheduler.submit(fingerprint, async () => {
            notifyReaction(reaction, 'processing');
            try {
                const result = await task();
                notifyReaction(reaction, 'succeeded');
                return result;
            }
            catch (error) {
                notifyReaction(reaction, 'failed');
                throw error;
            }
        });
    }
    getSnapshot() {
        return this.scheduler.getSnapshot();
    }
}
