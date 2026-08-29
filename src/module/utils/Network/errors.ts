import axios, { AxiosError } from 'axios'

export function toAxiosError (error: unknown): AxiosError {
  if (axios.isAxiosError(error)) return error
  if (error instanceof Error) {
    return AxiosError.from(error, getErrorCode(error))
  }
  return new AxiosError(String(error))
}

function getErrorCode (error: Error): string | undefined {
  const code = Reflect.get(error, 'code') as unknown
  return typeof code === 'string' ? code : undefined
}

export function isSslError (error: AxiosError): boolean {
  return error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    error.code === 'ERR_SSL_WRONG_VERSION_NUMBER' ||
    Boolean(error.message?.includes('SSL'))
}

export async function delay (ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}
