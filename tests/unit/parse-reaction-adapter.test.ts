import { describe, expect, it, vi } from 'vitest'

import { createEmojiParseReactionPort } from '../../src/module/utils/ParseReactionAdapter.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

const deferred = <T>(): Deferred<T> => {
  let resolveDeferred!: (value: T) => void
  const promise = new Promise<T>(resolve => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

describe('createEmojiParseReactionPort', () => {
  it('serializes terminal reactions after the processing reaction without blocking the caller', async () => {
    const processing = deferred<boolean>()
    const manager = {
      add: vi.fn(() => processing.promise),
      replace: vi.fn(async () => true)
    }
    const port = createEmojiParseReactionPort(manager, { terminalDelayMs: 0 })

    const processingState = port.setState('processing')
    const successState = port.setState('succeeded')

    expect(manager.add).toHaveBeenCalledWith('PROCESSING')
    expect(manager.replace).not.toHaveBeenCalled()

    processing.resolve(true)
    await Promise.all([processingState, successState])

    expect(manager.replace).toHaveBeenCalledWith('PROCESSING', 'SUCCESS', 0)
  })

  it('continues to the terminal reaction when adding processing fails', async () => {
    const manager = {
      add: vi.fn(async () => await Promise.reject(new Error('unsupported adapter'))),
      replace: vi.fn(async () => true)
    }
    const port = createEmojiParseReactionPort(manager, { terminalDelayMs: 0 })

    await Promise.all([
      port.setState('processing'),
      port.setState('failed')
    ])

    expect(manager.replace).toHaveBeenCalledWith('PROCESSING', 'ERROR', 0)
  })

  it('times out a stuck processing reaction before applying the terminal reaction', async () => {
    const manager = {
      add: vi.fn(() => new Promise<boolean>(() => {})),
      replace: vi.fn(async () => true)
    }
    const port = createEmojiParseReactionPort(manager, {
      terminalDelayMs: 0,
      timeoutMs: 20
    })

    const updates = Promise.all([
      port.setState('processing'),
      port.setState('failed')
    ])
    const settled = await Promise.race([
      updates.then(() => true),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 200))
    ])

    expect(settled).toBe(true)
    expect(manager.replace).toHaveBeenCalledWith('PROCESSING', 'ERROR', 0)
  })
})
