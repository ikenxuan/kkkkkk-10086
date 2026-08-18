import type { EmojiReactionManager } from './EmojiReaction.js'
import type { ParseReactionPort, ParseReactionState } from './ParseCoordinator.js'
import { runWithRequestGuard } from './RequestGuard.js'

type ReactionManager = Pick<EmojiReactionManager, 'add' | 'replace'>

export interface EmojiParseReactionOptions {
  terminalDelayMs?: number
  /** Maximum time a single remote reaction update may occupy the serial queue. */
  timeoutMs?: number
}

const DEFAULT_REACTION_TIMEOUT_MS = 10_000

const applyReactionState = async (
  manager: ReactionManager,
  state: ParseReactionState,
  terminalDelayMs: number
): Promise<void> => {
  if (state === 'processing') {
    await manager.add('PROCESSING')
    return
  }

  await manager.replace(
    'PROCESSING',
    state === 'succeeded' ? 'SUCCESS' : 'ERROR',
    terminalDelayMs
  )
}

/** Serializes remote reaction updates while keeping them outside the parse critical path. */
export const createEmojiParseReactionPort = (
  manager: ReactionManager,
  options: EmojiParseReactionOptions = {}
): ParseReactionPort => {
  const terminalDelayMs = options.terminalDelayMs ?? 0
  const timeoutMs = options.timeoutMs ?? DEFAULT_REACTION_TIMEOUT_MS
  let sequence: Promise<void> | undefined

  return {
    setState (state) {
      const update = async (): Promise<void> => {
        try {
          await runWithRequestGuard(
            async () => await applyReactionState(manager, state, terminalDelayMs),
            { timeoutMs, maxRetries: 0 }
          )
        } catch {
          // The in-memory coordinator is authoritative; reactions are best effort.
        }
      }

      sequence = sequence === undefined ? update() : sequence.then(update)
      return sequence
    }
  }
}
