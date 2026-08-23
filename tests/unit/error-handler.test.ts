import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/module/utils/Render.js', () => ({
  Render: vi.fn()
}))

vi.mock('../../src/runtime/host/config.js', () => ({
  default: { masterQQ: [], master: [] }
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: { app: { errorLogSendTo: [] } }
}))

let normalizeError: typeof import('../../src/module/utils/ErrorHandler/render.js').normalizeError
let errorHandlerExports: typeof import('../../src/module/utils/ErrorHandler/index.js')

beforeAll(async () => {
  ;({ normalizeError } = await import('../../src/module/utils/ErrorHandler/render.js'))
  errorHandlerExports = await import('../../src/module/utils/ErrorHandler/index.js')
})

describe('normalizeError', () => {
  it('preserves Error details', () => {
    const error = new TypeError('invalid payload')

    expect(normalizeError(error)).toMatchObject({
      name: 'TypeError',
      message: 'invalid payload',
      stack: expect.stringContaining('TypeError: invalid payload')
    })
  })

  it('normalizes string errors', () => {
    expect(normalizeError('request failed')).toEqual({
      name: 'Error',
      message: 'request failed',
      stack: ''
    })
  })

  it('preserves Axios-style error fields', () => {
    expect(normalizeError({
      name: 'AxiosError',
      message: 'Request failed with status code 503',
      stack: 'AxiosError: Request failed',
      code: 'ERR_BAD_RESPONSE',
      response: { status: 503 }
    })).toEqual({
      name: 'AxiosError',
      message: 'Request failed with status code 503',
      stack: 'AxiosError: Request failed'
    })
  })

  it('normalizes values that cannot be stringified normally', () => {
    expect(() => normalizeError(Object.create(null))).not.toThrow()
    expect(normalizeError(Object.create(null))).toEqual({
      name: 'Error',
      message: '[object Object]',
      stack: ''
    })
  })

  it('ignores properties whose access throws', () => {
    const error = Object.defineProperty({}, 'message', {
      get () {
        throw new Error('blocked getter')
      }
    })

    expect(() => normalizeError(error)).not.toThrow()
    expect(normalizeError(error).name).toBe('Error')
  })

  it('exports the normalizer from the ErrorHandler barrel', () => {
    expect(errorHandlerExports.normalizeError).toBe(normalizeError)
  })
})
