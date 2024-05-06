import crypto from 'crypto'

export function MsToken(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomBytes = crypto.randomBytes(length)
  return Array.from(randomBytes, (byte) => characters[byte % characters.length]).join('')
}
