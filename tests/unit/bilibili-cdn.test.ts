import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRealAmagiEnums } from '../helpers/amagi-enums.js'

import {
  BILIBILI_UPOS_MIRRORS,
  expandBilibiliCdnCandidates,
  isBilibiliPcdnUrl,
  isBilibiliProvincialUrl,
  isUposMirrorUrl,
  rewriteToUposMirror,
  rewriteToUpstreamSource
} from '../../src/module/platform/bilibili/cdn.js'

// ---------------------------------------------------------------------------
// bilibili.ts 的 import 链会拖进 puppeteer / sharp / amagi，单测里全部替掉。
// 这套 mock 抄自 bilibili-quality.test.ts，只保留本文件真正会碰到的部分。
// cdn.ts 自身没有任何 import，所以上面那组是普通的静态 import。
// ---------------------------------------------------------------------------

const configMock = vi.hoisted(() => ({
  bilibili: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>,
  app: {} as Record<string, unknown>,
  upload: {} as Record<string, unknown>,
  request: {} as Record<string, unknown>,
  getConfig: () => ({})
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: unknown
    headers: Record<string, string> = {}
  },
  baseHeaders: {},
  Config: configMock,
  Common: { tempDri: { images: '', video: '', default: '' }, useDarkTheme: () => false },
  Render: vi.fn(),
  Networks: class {
    url: string
    constructor (options: { url: string }) {
      this.url = options.url
    }

    async getHeaders (): Promise<Record<string, string>> {
      return {}
    }
  },
  mergeFile: vi.fn(),
  downloadFile: vi.fn(),
  downloadVideo: vi.fn(),
  uploadFile: vi.fn(),
  processImageUrl: vi.fn(),
  Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' }
}))

vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  bilibiliComments: vi.fn(),
  checkCk: vi.fn(),
  genParams: vi.fn()
}))

// 任何方法都返回 undefined，与旧的 `getBilibiliData: vi.fn()` 同义：这些用例不该走到取数
vi.mock('../../src/module/utils/amagiClient.js', () => ({
  loadAmagiEnums: loadRealAmagiEnums,
  bilibiliFetcher: new Proxy({}, { get: () => vi.fn() }),
  buildAmagiRequestConfig: vi.fn(() => ({}))
}))

vi.mock('../../src/module/platform/common/danmaku.js', () => ({
  burnDanmaku: vi.fn()
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn() }
}))

// Config 读 yaml 之前必须先有 logger：vitest 的并行 worker 会在这里撞上
// `ReferenceError: logger is not defined`。
globalThis.logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  mark: vi.fn()
} as unknown as typeof logger

const {
  collectBilibiliStreamUrls,
  pickBilibiliStreamUrl
} = await import('../../src/module/platform/bilibili/bilibili.js')

// ---------------------------------------------------------------------------
// 地址工厂
//
// 整个模块的前提是「换主机名不动路径和查询串」，所以这里的路径 / 签名串刻意做成
// 逼真的样子：断言会逐字比对它们改写前后是否一致。
// ---------------------------------------------------------------------------

const SIGNED_PATH = '/upgcxcode/12/34/1234567/1234567-1-30080.m4s'
const SIGNED_QUERY = 'e=ig8euxZM2rNcNb&deadline=1700000000&upsig=deadbeefcafe&uparams=e,deadline&oi=1&og=cos'

const MIRROR_1 = BILIBILI_UPOS_MIRRORS[0]!
const MIRROR_2 = BILIBILI_UPOS_MIRRORS[1]!

/** `*.mcdn.bilivideo.cn` 那一类：节点 IP 编进主机名，还带着非标端口 */
const mcdn = (path = SIGNED_PATH): string =>
  `https://xy183x59x212x21xy.mcdn.bilivideo.cn:4483${path}?${SIGNED_QUERY}`

/** `*.szbdyd.com` 那一类：查询串里带着 `xy_usource` 逃生口 */
const szbdyd = (usource: string, path = SIGNED_PATH): string =>
  `https://xy118x89x22x33xy.szbdyd.com:4483${path}?${SIGNED_QUERY}&xy_usource=${usource}`

/** 接口直接给的公网 upos 镜像 */
const upos = (code: string, path = SIGNED_PATH): string =>
  `https://upos-sz-mirror${code}.bilivideo.com${path}?${SIGNED_QUERY}`

/** 省级直连节点：公网可达，但常常是被限速的那批 */
const provincial = (path = SIGNED_PATH): string =>
  `https://cn-jsnt-ct-01-07.bilivideo.com${path}?${SIGNED_QUERY}`

const hostOf = (url: string): string => new URL(url).host

describe('isBilibiliPcdnUrl', () => {
  it('认出两个 PCDN 域', () => {
    expect(isBilibiliPcdnUrl(mcdn())).toBe(true)
    expect(isBilibiliPcdnUrl(szbdyd('upos-sz-mirrorhwo1.bilivideo.com'))).toBe(true)
  })

  it('公网镜像和省级节点都不算 PCDN', () => {
    expect(isBilibiliPcdnUrl(upos('cos'))).toBe(false)
    expect(isBilibiliPcdnUrl(provincial())).toBe(false)
    expect(isBilibiliPcdnUrl('https://upos-hz-mirrorakam.akamaized.net/x.m4s')).toBe(false)
  })

  it('只按主机名后缀判定，不会被路径里的同名串骗到', () => {
    expect(isBilibiliPcdnUrl('https://upos-sz-mirrorcos.bilivideo.com/a/mcdn.bilivideo.cn/x.m4s')).toBe(false)
    // 后缀必须落在点边界上：`notmcdn.bilivideo.cn` 是另一个域
    expect(isBilibiliPcdnUrl('https://evil-szbdyd.com/x.m4s')).toBe(false)
  })

  it('畸形地址返回 false 而不是抛错', () => {
    expect(isBilibiliPcdnUrl('')).toBe(false)
    expect(isBilibiliPcdnUrl('not a url')).toBe(false)
    expect(isBilibiliPcdnUrl('//protocol-relative/x.m4s')).toBe(false)
  })
})

describe('isUposMirrorUrl / isBilibiliProvincialUrl', () => {
  it('认出 upos 与 estgoss 两种镜像前缀', () => {
    expect(isUposMirrorUrl(upos('coso1'))).toBe(true)
    expect(isUposMirrorUrl('https://upos-hz-estgoss.bilivideo.com/x.m4s')).toBe(true)
    expect(isUposMirrorUrl(mcdn())).toBe(false)
    expect(isUposMirrorUrl(provincial())).toBe(false)
  })

  it('省级节点只认 cn-xx-xx-NN-NN 这个形状', () => {
    expect(isBilibiliProvincialUrl(provincial())).toBe(true)
    expect(isBilibiliProvincialUrl(upos('cos'))).toBe(false)
    expect(isBilibiliProvincialUrl('https://cn-jsnt-ct-01.bilivideo.com/x.m4s')).toBe(false)
  })

  it('畸形地址返回 false 而不是抛错', () => {
    expect(isUposMirrorUrl('not a url')).toBe(false)
    expect(isBilibiliProvincialUrl('not a url')).toBe(false)
  })
})

describe('rewriteToUposMirror', () => {
  it('只换主机名，路径与整套签名逐字保留', () => {
    const original = mcdn()
    const rewritten = rewriteToUposMirror(original, MIRROR_1)

    expect(rewritten).not.toBeNull()
    const before = new URL(original)
    const after = new URL(rewritten!)

    expect(after.hostname).toBe(MIRROR_1)
    expect(after.pathname).toBe(before.pathname)
    // search 逐字比对：upsig / deadline / uparams 少一个字符签名就废了
    expect(after.search).toBe(before.search)
    expect(after.search).toBe(`?${SIGNED_QUERY}`)
  })

  it('丢掉 PCDN 的非标端口，落到 https 的默认 443', () => {
    const rewritten = rewriteToUposMirror(mcdn(), MIRROR_1)!

    expect(rewritten).not.toContain(':4483')
    expect(new URL(rewritten).protocol).toBe('https:')
    // WHATWG URL 不会把 https 的默认端口序列化出来，port 为空串即 443
    expect(new URL(rewritten).port).toBe('')
    expect(rewritten).toBe(`https://${MIRROR_1}${SIGNED_PATH}?${SIGNED_QUERY}`)
  })

  it('http 一并升到 https', () => {
    const rewritten = rewriteToUposMirror(`http://xy1xy.mcdn.bilivideo.cn:4483${SIGNED_PATH}`, MIRROR_1)

    expect(rewritten).toBe(`https://${MIRROR_1}${SIGNED_PATH}`)
  })

  it('路径里的转义字符不被重写', () => {
    const path = '/upgcxcode/a%20b/c%2Fd/x.m4s'
    const rewritten = rewriteToUposMirror(mcdn(path), MIRROR_1)!

    expect(new URL(rewritten).pathname).toBe(path)
  })

  it('非 http(s) 协议与畸形地址返回 null', () => {
    expect(rewriteToUposMirror('ftp://example.com/x.m4s', MIRROR_1)).toBeNull()
    expect(rewriteToUposMirror('not a url', MIRROR_1)).toBeNull()
    expect(rewriteToUposMirror('', MIRROR_1)).toBeNull()
  })
})

describe('rewriteToUpstreamSource', () => {
  it('拿 xy_usource 换掉主机名，其余原样', () => {
    const original = szbdyd('upos-sz-mirrorhwo1.bilivideo.com')
    const rewritten = rewriteToUpstreamSource(original)

    expect(rewritten).not.toBeNull()
    const after = new URL(rewritten!)
    expect(after.hostname).toBe('upos-sz-mirrorhwo1.bilivideo.com')
    expect(after.pathname).toBe(SIGNED_PATH)
    expect(after.port).toBe('')
    // xy_usource 本身留在查询串里 —— 它是签名覆盖的参数，删掉会让签名不过
    expect(after.searchParams.get('upsig')).toBe('deadbeefcafe')
    expect(after.searchParams.get('xy_usource')).toBe('upos-sz-mirrorhwo1.bilivideo.com')
  })

  it('没有 xy_usource 时返回 null', () => {
    expect(rewriteToUpstreamSource(mcdn())).toBeNull()
    expect(rewriteToUpstreamSource(upos('cos'))).toBeNull()
  })

  it('xy_usource 为空串时返回 null', () => {
    expect(rewriteToUpstreamSource(szbdyd(''))).toBeNull()
  })

  it('xy_usource 不像主机名就不用 —— 那是接口给的外部数据', () => {
    // 带路径：塞进 hostname 会把 URL 拼歪
    expect(rewriteToUpstreamSource(szbdyd('evil.com%2Fpath'))).toBeNull()
    // 纯 IP：末段不是字母，判定拒掉
    expect(rewriteToUpstreamSource(szbdyd('1.2.3.4'))).toBeNull()
    // 没有点的裸主机名
    expect(rewriteToUpstreamSource(szbdyd('localhost'))).toBeNull()
  })

  it('畸形地址返回 null 而不是抛错', () => {
    expect(rewriteToUpstreamSource('not a url')).toBeNull()
    expect(rewriteToUpstreamSource('')).toBeNull()
  })
})

describe('expandBilibiliCdnCandidates', () => {
  it('接口给的公网地址排在改写地址前面', () => {
    const apiMirror = upos('cos')
    const result = expandBilibiliCdnCandidates([mcdn(), apiMirror])

    expect(result[0]).toBe(apiMirror)
    expect(result.length).toBeGreaterThan(1)
  })

  it('省级节点垫在公网镜像之后、改写地址之前', () => {
    const apiMirror = upos('cos')
    const result = expandBilibiliCdnCandidates([provincial(), apiMirror])
    const hosts = result.map(hostOf)

    expect(hosts.indexOf(hostOf(apiMirror))).toBeLessThan(hosts.indexOf(hostOf(provincial())))
  })

  it('xy_usource 逃生口排在猜出来的镜像前面', () => {
    const result = expandBilibiliCdnCandidates([szbdyd('upos-sz-mirroraliov.bilivideo.com')])
    const hosts = result.map(hostOf)

    expect(hosts.indexOf('upos-sz-mirroraliov.bilivideo.com')).toBeLessThan(hosts.indexOf(MIRROR_1))
  })

  it('接口一条公网地址都不给时仍然造得出可用地址', () => {
    const result = expandBilibiliCdnCandidates([mcdn()])

    // 除了 PCDN 原地址，至少还有两条改写出来的镜像
    const rewritten = result.filter(url => isUposMirrorUrl(url))
    expect(rewritten).toEqual([
      `https://${MIRROR_1}${SIGNED_PATH}?${SIGNED_QUERY}`,
      `https://${MIRROR_2}${SIGNED_PATH}?${SIGNED_QUERY}`
    ])
  })

  it('PCDN 原地址垫在最后，但不丢掉', () => {
    const apiMirror = upos('cos')
    const pcdnUrl = mcdn()
    const result = expandBilibiliCdnCandidates([pcdnUrl, apiMirror])

    // 不丢：国内运营商网络上 PCDN 才是最快的一条，剔掉等于白扔最优路径
    expect(result).toContain(pcdnUrl)
    // 垫底：只有前面每一条都失败才会碰它，而 DNS 失败是即时的
    expect(result[result.length - 1]).toBe(pcdnUrl)
    expect(result.filter(url => isBilibiliPcdnUrl(url))).toEqual([pcdnUrl])
  })

  it('多条 PCDN 地址全部保留，且都在非 PCDN 之后', () => {
    const first = mcdn()
    const second = szbdyd('upos-sz-mirroraliov.bilivideo.com')
    const result = expandBilibiliCdnCandidates([first, second, upos('cos')])

    expect(result).toContain(first)
    expect(result).toContain(second)

    const firstPcdnAt = result.findIndex(url => isBilibiliPcdnUrl(url))
    const nonPcdn = result.filter(url => !isBilibiliPcdnUrl(url))
    expect(result.slice(0, firstPcdnAt)).toEqual(nonPcdn)
  })

  it('按 host + path 去重，保留首次出现的次序', () => {
    const apiMirror = upos('cos')
    const result = expandBilibiliCdnCandidates([apiMirror, apiMirror, mcdn(), mcdn()])

    expect(new Set(result).size).toBe(result.length)
    expect(result.filter(url => url === apiMirror)).toHaveLength(1)
    expect(result.filter(url => url === mcdn())).toHaveLength(1)
  })

  it('改写结果撞上接口已经给过的镜像时去掉重复的那条', () => {
    // 接口给的就是第一个镜像 —— 套镜像会产出同一个 host + path
    const result = expandBilibiliCdnCandidates([mcdn(), upos(MIRROR_1.replace('upos-sz-mirror', '').replace('.bilivideo.com', ''))])
    const firstMirrorHits = result.filter(url => hostOf(url) === MIRROR_1)

    expect(firstMirrorHits).toHaveLength(1)
    // 留下的是接口给的那条（排在最前），不是改写出来的
    expect(result[0]).toBe(firstMirrorHits[0])
  })

  it('查询串不同但 host + path 相同的两条视为同一条', () => {
    const a = `https://${MIRROR_1}${SIGNED_PATH}?upsig=aaa`
    const b = `https://${MIRROR_1}${SIGNED_PATH}?upsig=bbb`

    expect(expandBilibiliCdnCandidates([a, b])).toEqual([a])
  })

  it('mirrorLimit 控制猜出来的镜像条数', () => {
    const none = expandBilibiliCdnCandidates([mcdn()], BILIBILI_UPOS_MIRRORS, 0)
    expect(none.filter(url => isUposMirrorUrl(url))).toEqual([])
    // PCDN 原地址仍然在，mirrorLimit 只管改写那部分
    expect(none).toEqual([mcdn()])

    const four = expandBilibiliCdnCandidates([mcdn()], BILIBILI_UPOS_MIRRORS, 4)
    expect(four.filter(url => isUposMirrorUrl(url))).toHaveLength(4)
  })

  it('负的 mirrorLimit 当 0 处理', () => {
    expect(expandBilibiliCdnCandidates([mcdn()], BILIBILI_UPOS_MIRRORS, -3)).toEqual([mcdn()])
  })

  it('传入自定义镜像顺序时改写地址跟着走（测速结果的入口）', () => {
    const probed = ['upos-sz-mirrorbd.bilivideo.com', 'upos-sz-mirrorhw.bilivideo.com']
    const result = expandBilibiliCdnCandidates([mcdn()], probed, 2)

    expect(result.filter(url => isUposMirrorUrl(url)).map(hostOf)).toEqual(probed)
  })

  it('只有省级节点时也拿它当改写源', () => {
    const result = expandBilibiliCdnCandidates([provincial()])

    expect(result[0]).toBe(provincial())
    expect(result.filter(url => isUposMirrorUrl(url)).map(hostOf)).toEqual([MIRROR_1, MIRROR_2])
  })

  it('空输入返回空数组', () => {
    expect(expandBilibiliCdnCandidates([])).toEqual([])
    expect(expandBilibiliCdnCandidates(['', ''])).toEqual([])
  })

  it('畸形输入不抛错', () => {
    const apiMirror = upos('cos')
    const messy = [
      '',
      'not a url',
      'ftp://example.com/x.m4s',
      null as unknown as string,
      undefined as unknown as string,
      123 as unknown as string,
      apiMirror,
      mcdn()
    ]

    let result: string[] = []
    expect(() => { result = expandBilibiliCdnCandidates(messy) }).not.toThrow()
    // 能用的两条照样在，PCDN 那条照样垫底
    expect(result).toContain(apiMirror)
    expect(result[result.length - 1]).toBe(mcdn())
  })

  it('不修改调用方传进来的数组', () => {
    const input = [mcdn(), upos('cos')]
    const snapshot = [...input]
    expandBilibiliCdnCandidates(input)

    expect(input).toEqual(snapshot)
  })
})

describe('BILIBILI_UPOS_MIRRORS', () => {
  it('全部是 upos 体系里的主机名 —— 签名只在这套里通用', () => {
    for (const mirror of BILIBILI_UPOS_MIRRORS) {
      expect(isUposMirrorUrl(`https://${mirror}/x.m4s`)).toBe(true)
    }
  })

  it('没有重复项，且冻结', () => {
    expect(new Set(BILIBILI_UPOS_MIRRORS).size).toBe(BILIBILI_UPOS_MIRRORS.length)
    expect(Object.isFrozen(BILIBILI_UPOS_MIRRORS)).toBe(true)
  })

  it('带 o1 后缀的那组在前 —— rconsole 的 replaceP2PUrl 实际改写到的就是它们', () => {
    expect(BILIBILI_UPOS_MIRRORS[0]).toBe('upos-sz-mirrorcoso1.bilivideo.com')
    expect(BILIBILI_UPOS_MIRRORS).toContain('upos-sz-mirroralio1.bilivideo.com')
    expect(BILIBILI_UPOS_MIRRORS).toContain('upos-sz-mirrorhwo1.bilivideo.com')
  })
})

describe('pickBilibiliStreamUrl', () => {
  beforeEach(() => {
    configMock.bilibili = {}
    configMock.cookies = {}
  })

  it('普通非 PCDN 的 base_url 原样返回 —— 既有调用点行为不变', () => {
    const base = upos('cos')

    expect(pickBilibiliStreamUrl({ base_url: base })).toBe(base)
    expect(pickBilibiliStreamUrl({ base_url: base, backup_url: [upos('bd')] })).toBe(base)
  })

  it('base_url 指到 PCDN 时挑 backup_url 里第一条非 PCDN 的', () => {
    const backup = upos('bd')

    expect(pickBilibiliStreamUrl({ base_url: mcdn(), backup_url: [backup] })).toBe(backup)
  })

  it('durl 那一路的 url 键同样认', () => {
    const direct = upos('cos')

    expect(pickBilibiliStreamUrl({ url: direct })).toBe(direct)
  })

  it('全是 PCDN 时退回第一条，行为与以前一致', () => {
    const first = mcdn()

    expect(pickBilibiliStreamUrl({ base_url: first, backup_url: [szbdyd('x.bilivideo.com')] })).toBe(first)
  })

  it('一条地址都没有时返回空串', () => {
    expect(pickBilibiliStreamUrl(undefined)).toBe('')
    expect(pickBilibiliStreamUrl({})).toBe('')
    expect(pickBilibiliStreamUrl({ base_url: '' })).toBe('')
  })

  it('等价于 collectBilibiliStreamUrls 的第一条', () => {
    const stream = { base_url: upos('cos'), backup_url: [upos('bd')] }

    expect(pickBilibiliStreamUrl(stream)).toBe(collectBilibiliStreamUrls(stream)[0])
  })
})

describe('collectBilibiliStreamUrls', () => {
  beforeEach(() => {
    configMock.bilibili = {}
    configMock.cookies = {}
  })

  it('auto（默认）：接口地址在前，PCDN 那条补上改写地址后垫底', () => {
    const result = collectBilibiliStreamUrls({ base_url: mcdn(), backup_url: [upos('cos')] })

    expect(result[0]).toBe(upos('cos'))
    expect(result).toContain(mcdn())
    expect(result[result.length - 1]).toBe(mcdn())
  })

  it('origin：一个字都不改，只去重', () => {
    configMock.bilibili = { bilibiliCdnMode: 'origin' }
    const result = collectBilibiliStreamUrls({ base_url: mcdn(), backup_url: [mcdn(), upos('cos')] })

    expect(result).toEqual([mcdn(), upos('cos')])
    expect(result.filter(url => isUposMirrorUrl(url))).toEqual([upos('cos')])
  })

  it('mirror：镜像顶到最前，接口原地址退居备用', () => {
    configMock.bilibili = { bilibiliCdnMode: 'mirror' }
    const result = collectBilibiliStreamUrls({ base_url: mcdn(), backup_url: [provincial()] })

    expect(isUposMirrorUrl(result[0]!)).toBe(true)
    // 原地址不丢 —— 镜像那边没有这份文件（404）时还得靠它们兜底
    expect(result).toContain(provincial())
    expect(result).toContain(mcdn())
  })

  it('mirror：一条镜像都造不出来时退回 auto 的次序', () => {
    configMock.bilibili = { bilibiliCdnMode: 'mirror' }
    const plain = 'https://example.bilivideo.com/x.m4s'
    const result = collectBilibiliStreamUrls({ base_url: plain })

    expect(result).toEqual([plain])
  })

  it('一条地址都没有时返回空数组', () => {
    expect(collectBilibiliStreamUrls(undefined)).toEqual([])
    expect(collectBilibiliStreamUrls({})).toEqual([])
  })

  it('把 base_url、durl 的 url 和 backup_url 一起收进来', () => {
    const result = collectBilibiliStreamUrls({
      base_url: upos('cos'),
      url: upos('bd'),
      backup_url: [upos('hw')]
    })

    expect(result.map(hostOf)).toEqual([
      'upos-sz-mirrorcos.bilivideo.com',
      'upos-sz-mirrorbd.bilivideo.com',
      'upos-sz-mirrorhw.bilivideo.com'
    ])
  })
})
