import { exec } from 'child_process'

class FFmpeg {
  checkEnv() {
    return new Promise((resolve, reject) => {
      exec('ffmpeg -version', (err) => {
        if (err) {
          console.log('ffmepg未安装')
          resolve(false)
        }
        resolve(true)
      })
    })
  }

  VideoComposite(path = '', path2 = '', resultPath = '', suc, faith = () => {}) {
    exec(`ffmpeg -y -i ${path} -i ${path2} -c copy ${resultPath}`, async function (err) {
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

export default new FFmpeg()
