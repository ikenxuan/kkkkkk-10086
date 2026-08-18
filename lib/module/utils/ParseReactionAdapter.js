import { runWithRequestGuard } from './RequestGuard.js';
const DEFAULT_REACTION_TIMEOUT_MS = 10_000;
const applyReactionState = async (manager, state, terminalDelayMs) => {
    if (state === 'processing') {
        await manager.add('PROCESSING');
        return;
    }
    await manager.replace('PROCESSING', state === 'succeeded' ? 'SUCCESS' : 'ERROR', terminalDelayMs);
};
/** Serializes remote reaction updates while keeping them outside the parse critical path. */
export const createEmojiParseReactionPort = (manager, options = {}) => {
    const terminalDelayMs = options.terminalDelayMs ?? 0;
    const timeoutMs = options.timeoutMs ?? DEFAULT_REACTION_TIMEOUT_MS;
    let sequence;
    return {
        setState(state) {
            const update = async () => {
                try {
                    await runWithRequestGuard(async () => await applyReactionState(manager, state, terminalDelayMs), { timeoutMs, maxRetries: 0 });
                }
                catch {
                    // The in-memory coordinator is authoritative; reactions are best effort.
                }
            };
            sequence = sequence === undefined ? update() : sequence.then(update);
            return sequence;
        }
    };
};
