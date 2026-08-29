import { Transform } from 'node:stream'

/** 主动限速用的中间流：按设定的字节率把块延后 push，让下载贴着目标速率走。 */
export class ThrottleStream extends Transform {
  private readonly bytesPerSecond: number
  private readonly startTime = Date.now()
  private totalBytes = 0

  constructor (bytesPerSecond: number) {
    super()
    this.bytesPerSecond = bytesPerSecond
  }

  override _transform (
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.totalBytes += chunk.length
    const elapsed = (Date.now() - this.startTime) / 1000
    const expectedTime = this.totalBytes / this.bytesPerSecond
    const wait = Math.max(0, (expectedTime - elapsed) * 1000)
    if (wait > 0) {
      setTimeout(() => {
        this.push(chunk)
        callback()
      }, wait)
      return
    }
    this.push(chunk)
    callback()
  }
}
