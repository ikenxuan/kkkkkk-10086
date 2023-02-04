/**
 * 
 * @param time 输入的时间 单位毫秒
 * @returns 
 */
export async function sleep(time) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    })
}
