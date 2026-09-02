import { Transform } from 'node:stream';
/** 主动限速用的中间流：按设定的字节率把块延后 push，让下载贴着目标速率走。 */
export class ThrottleStream extends Transform {
    bytesPerSecond;
    startTime = Date.now();
    totalBytes = 0;
    constructor(bytesPerSecond) {
        super();
        this.bytesPerSecond = bytesPerSecond;
    }
    _transform(chunk, _encoding, callback) {
        this.totalBytes += chunk.length;
        const elapsed = (Date.now() - this.startTime) / 1000;
        const expectedTime = this.totalBytes / this.bytesPerSecond;
        const wait = Math.max(0, (expectedTime - elapsed) * 1000);
        if (wait > 0) {
            setTimeout(() => {
                this.push(chunk);
                callback();
            }, wait);
            return;
        }
        this.push(chunk);
        callback();
    }
}
