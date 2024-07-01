import { exec } from 'child_process'
import { logger } from '#lib'

class FFmpeg {
  /** 检查FFmpeg环境 */
  checkEnv () {
    return new Promise((resolve, reject) => {
      exec('ffmpeg -version', (err) => {
        if (err) {
          logger.error('ffmepg未安装')
          resolve(false)
        }
        resolve(true)
      })
    })
  }

  /**
   * @param {number} 合成方式
   * @param {string} 文件1路径
   * @param {string} 文件2路径
   * @param {string} 合成后的路径
   * @param {any} suc 合成成功后的处理函数
   * @param {any} faith 合成失败后的处理函数
   */
  VideoComposite (v = 1, path = '', path2 = '', resultPath = '', suc, faith = () => { }) {
    if (v === 1) {
      exec(`ffmpeg -y -i ${path} -i ${path2} -c copy ${resultPath}`, async function (err) {
        if (err) {
          logger.error('视频合成失败\n', err)
          await faith()
        } else {
          logger.mark('视频合成成功')
          await suc()
        }
      })
    } else if (v === 2) {
      exec(`ffmpeg -y -stream_loop 3 -i ${path} -i ${path2} -c:v copy -map 0:v -map 1:a -shortest ${resultPath}`, async function (err) {
        if (err) {
          logger.error('视频合成失败\n', err)
          await faith()
        } else {
          logger.mark('视频合成成功')
          await suc()
        }
      })
    }
  }
}

export default new FFmpeg()
