import { describe, expect, it } from 'vitest'

import { sanitizeFilename, sanitizeFilenameSegment } from '../../src/module/utils/filename.js'

/**
 * 这些名字来自远端作品标题（抖音 preview_title、B站 share_copy / desc、快手 caption、
 * 小红书 title），落盘后会被拼进 ffmpeg 的命令串，而 FFmpeg.ts 的 exec 走 shell。
 *
 * 实测确认过可达性：标题里一对反引号，在 POSIX sh 下双引号内仍做命令替换，payload
 * 会真的执行（Windows 的 cmd.exe 不认反引号，所以只打 Linux / macOS 用户）。
 * 修复前仓库里有 8 处各写一遍的 `[\\/:*?"<>|\r\n\s]`，只挡文件系统非法字符，
 * 反引号、$、;、& 全部放过。
 *
 * 这组用例钉住「清洗器不许把任何 shell / cmd 元字符放过去」。
 * 注意它不替代参数化执行：命令构造改 execFile + 参数数组才是根治。
 */
const SHELL_METACHARACTERS = /[`$;&|"'<>()^%\r\n\t\v\f\0]/

describe('sanitizeFilenameSegment', () => {
  it.each([
    ['反引号命令替换', '视频`touch PWNED`标题'],
    ['$() 命令替换', '视频$(touch PWNED)标题'],
    ['${} 变量展开', '视频${HOME}标题'],
    ['分号串命令', '视频;touch PWNED;'],
    ['& 后台执行', '视频&touch PWNED&'],
    ['管道', '视频|touch PWNED|'],
    ['双引号闭合逃逸', '视频" ; touch PWNED ; "'],
    ['单引号闭合逃逸', "视频' ; touch PWNED ; '"],
    ['换行注入', '视频\ntouch PWNED\n'],
    ['回车注入', '视频\rtouch PWNED\r'],
    ['NUL 截断', '视频\0touch PWNED'],
    ['cmd 变量展开', '视频%CD%标题'],
    ['cmd 转义符', '视频^&touch PWNED'],
    ['重定向', '视频>out.txt<in.txt'],
    ['子 shell', '视频(touch PWNED)'],
  ])('中和 %s', (_name, payload) => {
    expect(sanitizeFilenameSegment(payload)).not.toMatch(SHELL_METACHARACTERS)
  })

  it('保留正常中文标题的可读性', () => {
    expect(sanitizeFilenameSegment('【4K】这是一个正常的视频标题')).toBe('【4K】这是一个正常的视频标题')
  })

  it('保留正常英文标题里的空格', () => {
    expect(sanitizeFilenameSegment('My Video Title 2026')).toBe('My Video Title 2026')
  })

  it('折叠清洗产生的连续空白', () => {
    // 一串元字符会各自变成一个空格，留着既难看也没意义
    expect(sanitizeFilenameSegment('a;;;;b')).toBe('a b')
  })

  it('按 maxLength 截断', () => {
    expect(sanitizeFilenameSegment('a'.repeat(80), 50)).toHaveLength(50)
  })

  it('空输入走兜底', () => {
    expect(sanitizeFilenameSegment('', 50, 'video')).toBe('video')
    expect(sanitizeFilenameSegment(undefined, 50, 'video')).toBe('video')
    expect(sanitizeFilenameSegment(null, 50, 'video')).toBe('video')
  })

  it('全是元字符时也走兜底，而不是返回一串空格', () => {
    // 没有这条的话，清洗结果会是 '   '，落盘得到一个纯空白文件名
    expect(sanitizeFilenameSegment('```$$$;;;', 50, 'video')).toBe('video')
  })
})

describe('sanitizeFilename', () => {
  it('中和主干里的注入 payload 并保留扩展名', () => {
    const out = sanitizeFilename('视频`touch PWNED`标题.mp4')
    expect(out).not.toMatch(SHELL_METACHARACTERS)
    expect(out.endsWith('.mp4')).toBe(true)
  })

  it('长度限制只作用于主干，扩展名完整保留', () => {
    // 截断到一半的扩展名会让后续按后缀判类型的逻辑失效（ffmpeg 容器推断、图片扩展名判断）
    const out = sanitizeFilename(`${'a'.repeat(80)}.mp4`, 50, 'video')
    expect(out).toBe(`${'a'.repeat(50)}.mp4`)
  })

  it('扩展名本身也清洗', () => {
    // `.mp4;rm -rf /` 这种形状远端也能给出
    expect(sanitizeFilename('video.mp4;rm -rf /')).not.toMatch(SHELL_METACHARACTERS)
  })

  it('没有扩展名时按 segment 处理', () => {
    expect(sanitizeFilename('没有扩展名的标题')).toBe('没有扩展名的标题')
  })

  it('首字符是点时不当作扩展名', () => {
    // '.bashrc' 的 lastIndexOf('.') 是 0，不能把整个名字当扩展名
    expect(sanitizeFilename('.bashrc')).toBe('.bashrc')
  })
})
