import { beforeEach, describe, expect, it } from 'vitest'

import {
  CDN_CANDIDATE_TTL_MS,
  CDN_HOST_PENALTY_MS,
  CDN_REGISTRY_CAPACITY,
  classifyCdnFailure,
  getCdnCandidates,
  getCdnRegistrySnapshot,
  isCdnHostPenalized,
  isDownloadableUrl,
  orderCdnCandidates,
  readErrorStatus,
  rememberCdnCandidates,
  reportCdnFailure,
  reportCdnSuccess,
  resetCdnRegistry,
  resolveCdnCandidates
} from '../../src/module/utils/CdnRegistry.js'

// 这个文件不备 globalThis.logger：CdnRegistry 只 import 零依赖的 record.js，
// 整条链上碰不到宿主日志和 Config，所以不存在别的单测里那个
// `ReferenceError: logger is not defined` 的坑。

const T0 = 1_700_000_000_000

/** 资源键的形状照抄模块注释里的例子：平台:作品:哪一路流 */
const KEY = 'bili:BV1xx411c7mD:video'

const SIGNED = 'e=ig8euxZM2rNcNb&deadline=1700000000&upsig=deadbeefcafe&uparams=e,deadline'

/** B站公网 upos 镜像。整个模块按主机名记账，所以路径默认给同一条 */
const upos = (code: string, path = '/upgcxcode/12/34/1234567-1-30080.m4s'): string =>
  `https://upos-sz-mirror${code}.bilivideo.com${path}?${SIGNED}`

/** 抖音签名直链：`url_list` 里那种，主机名带节点编号 */
const douyinvod = (node: string): string =>
  `https://${node}.douyinvod.com/video/tos/cn/tos-cn-ve-15/abcdef/?a=1&br=2`

const A = upos('cos')
const B = upos('bd')
const C = upos('hw')

/** 造 n 个互不相同主机的地址，用来撑容量 */
const nodeUrl = (index: number): string => `https://node${index}.example.com/video.m4s`

// 每个用例都从空地址簿开始：主机健康是跨资源、跨用例的进程级状态，
// 漏了这一句的话前一个用例罚过的主机会让后一个用例的排序莫名其妙。
beforeEach(() => {
  resetCdnRegistry()
})

describe('resetCdnRegistry', () => {
  it('两层记忆一起清空', () => {
    rememberCdnCandidates(KEY, [A, B], T0)
    reportCdnFailure(A, 'blocked', T0)
    expect(getCdnRegistrySnapshot(T0)).toMatchObject({ resources: 1, hosts: 1 })

    resetCdnRegistry()

    expect(getCdnRegistrySnapshot(T0)).toEqual({ resources: 0, hosts: 0, penalized: [] })
    expect(getCdnCandidates(KEY, T0)).toEqual([])
    expect(isCdnHostPenalized(A, T0)).toBe(false)
  })
})

describe('isDownloadableUrl', () => {
  it.each([
    ['https', 'https://a.example.com/x.m4s'],
    ['http', 'http://a.example.com/x.m4s'],
    ['大写协议', 'HTTPS://A.EXAMPLE.COM/x.m4s'],
    ['带非标端口', 'https://xy1xy.mcdn.bilivideo.cn:4483/x.m4s']
  ])('%s 可用', (_label, url) => {
    expect(isDownloadableUrl(url)).toBe(true)
  })

  it.each([
    ['空串', ''],
    ['不是 URL', 'not a url'],
    ['协议相对', '//a.example.com/x.m4s'],
    // file: / ftp: 混进下载地址就是本地文件读取的口子，必须在这一层拦掉
    ['file:', 'file:///etc/passwd'],
    ['ftp:', 'ftp://a.example.com/x.m4s'],
    ['data:', 'data:text/plain,hi'],
    ['null', null],
    ['undefined', undefined],
    ['数字', 123],
    ['数组', ['https://a.example.com/x.m4s']]
  ])('%s 不可用', (_label, url) => {
    expect(isDownloadableUrl(url)).toBe(false)
  })
})

describe('orderCdnCandidates', () => {
  it('没有惩罚记录时逐字保持调用方给的次序', () => {
    expect(orderCdnCandidates([A, B, C], T0)).toEqual([A, B, C])
  })

  it('按地址原文去重，保留首次出现的位置', () => {
    expect(orderCdnCandidates([A, B, A, B, A], T0)).toEqual([A, B])
  })

  it('查询串不同就是两条 —— 去重按原文比，不按 host + path', () => {
    const other = `${A}&extra=1`

    expect(orderCdnCandidates([A, other], T0)).toEqual([A, other])
  })

  it('剔掉不可下载的地址，不抛错', () => {
    const messy = ['', 'not a url', 'file:///etc/passwd', 'ftp://x/y', null, undefined, 42, A]

    expect(orderCdnCandidates(messy, T0)).toEqual([A])
  })

  it('被罚的主机挪到队尾，其余相对次序不动', () => {
    reportCdnFailure(B, 'blocked', T0)

    expect(orderCdnCandidates([A, B, C], T0 + 1)).toEqual([A, C, B])
  })

  it('多个被罚的主机之间也保持原有相对次序', () => {
    reportCdnFailure(A, 'blocked', T0)
    reportCdnFailure(C, 'missing', T0)

    expect(orderCdnCandidates([A, B, C], T0 + 1)).toEqual([B, A, C])
  })

  it('不修改调用方传进来的数组', () => {
    const input = [A, B, A]
    const snapshot = [...input]
    reportCdnFailure(A, 'network', T0)
    orderCdnCandidates(input, T0 + 1)

    expect(input).toEqual(snapshot)
  })

  it('空输入返回空数组', () => {
    expect(orderCdnCandidates([], T0)).toEqual([])
  })
})

describe('主机健康：惩罚与解除', () => {
  it('按 hostname 记账，跨资源生效', () => {
    reportCdnFailure(upos('cos', '/upgcxcode/aa/bb/1-1-30080.m4s'), 'blocked', T0)

    // 换一份完全不同的资源，只要还落在同一台机器上就照样被排后面
    expect(isCdnHostPenalized(upos('cos', '/upgcxcode/zz/yy/9-9-30112.m4s'), T0 + 1)).toBe(true)
  })

  it('主机名大小写不敏感', () => {
    reportCdnFailure('https://V26-WEB.DOUYINVOD.COM/video/tos/a/', 'blocked', T0)

    expect(isCdnHostPenalized(douyinvod('v26-web'), T0 + 1)).toBe(true)
  })

  it('端口不进键 —— PCDN 的 :4483 和默认端口是同一台机器', () => {
    reportCdnFailure('https://xy1xy.mcdn.bilivideo.cn:4483/upgcxcode/a.m4s', 'network', T0)

    expect(isCdnHostPenalized('https://xy1xy.mcdn.bilivideo.cn/upgcxcode/b.m4s', T0 + 1)).toBe(true)
  })

  it('惩罚期到点自动解除', () => {
    reportCdnFailure(B, 'blocked', T0)

    expect(isCdnHostPenalized(B, T0 + CDN_HOST_PENALTY_MS - 1)).toBe(true)
    // penalizedUntil <= now 就算过期，边界那一刻算可用
    expect(isCdnHostPenalized(B, T0 + CDN_HOST_PENALTY_MS)).toBe(false)
  })

  it('惩罚期过了之后排序回到调用方给的次序', () => {
    reportCdnFailure(B, 'blocked', T0)

    expect(orderCdnCandidates([A, B, C], T0 + CDN_HOST_PENALTY_MS - 1)).toEqual([A, C, B])
    expect(orderCdnCandidates([A, B, C], T0 + CDN_HOST_PENALTY_MS)).toEqual([A, B, C])
  })

  it('再失败一次会把惩罚期从头续上', () => {
    reportCdnFailure(B, 'blocked', T0)
    reportCdnFailure(B, 'network', T0 + CDN_HOST_PENALTY_MS - 1)

    // 第一次的惩罚本来在这一刻就该过期了
    expect(isCdnHostPenalized(B, T0 + CDN_HOST_PENALTY_MS)).toBe(true)
    expect(isCdnHostPenalized(B, T0 + CDN_HOST_PENALTY_MS * 2 - 2)).toBe(true)
    expect(isCdnHostPenalized(B, T0 + CDN_HOST_PENALTY_MS * 2 - 1)).toBe(false)
  })

  it('成功一次立刻解除惩罚，但失败次数留着', () => {
    reportCdnFailure(A, 'blocked', T0)
    reportCdnSuccess(A)

    expect(isCdnHostPenalized(A, T0 + 1)).toBe(false)
    // 主机本身还记着 —— 下一次失败是第 2 次，不是第 1 次
    reportCdnFailure(A, 'missing', T0 + 2)
    expect(getCdnRegistrySnapshot(T0 + 3).penalized).toEqual([{
      host: 'upos-sz-mirrorcos.bilivideo.com',
      failures: 2,
      lastKind: 'missing',
      penaltyRemainingMs: CDN_HOST_PENALTY_MS - 1
    }])
  })

  it('对没见过的主机报成功不建条目 —— 成功不该占地址簿的额度', () => {
    reportCdnSuccess(A)

    expect(getCdnRegistrySnapshot(T0).hosts).toBe(0)
  })

  it.each([
    ['空串', ''],
    ['不是 URL', 'not a url'],
    ['file:', 'file:///etc/passwd']
  ])('%s 的失败报告被忽略，不建条目', (_label, url) => {
    reportCdnFailure(url, 'blocked', T0)

    expect(getCdnRegistrySnapshot(T0).hosts).toBe(0)
    expect(isCdnHostPenalized(url, T0)).toBe(false)
  })
})

describe('resolveCdnCandidates', () => {
  it('去重，且调用方给的第一条留在最前', () => {
    // 调用方给的次序本身带信息（B站 base_url 在前、抖音签名直链在 url_list[0]），
    // 这一层只做去重，不重新打分
    expect(resolveCdnCandidates(KEY, [A, B, A, C, B], T0)).toEqual([A, B, C])
  })

  it('这次拿到的排在记着的前面 —— 新签名一定比缓存里的新', () => {
    resolveCdnCandidates(KEY, [A, B, C], T0)

    // 第二次接口只给了一条，缓存里那三条作为补充接在后面
    expect(resolveCdnCandidates(KEY, [douyinvod('v3-web')], T0 + 1000)).toEqual([
      douyinvod('v3-web'), A, B, C
    ])
  })

  it('这次已经给过的地址不会因为缓存里也有而重复一遍', () => {
    resolveCdnCandidates(KEY, [A, B], T0)

    expect(resolveCdnCandidates(KEY, [B, A], T0 + 1000)).toEqual([B, A])
  })

  it('候选清单到期后只剩这次拿到的', () => {
    resolveCdnCandidates(KEY, [A, B], T0)

    expect(resolveCdnCandidates(KEY, [C], T0 + CDN_CANDIDATE_TTL_MS - 1)).toEqual([C, A, B])

    resetCdnRegistry()
    resolveCdnCandidates(KEY, [A, B], T0)
    expect(resolveCdnCandidates(KEY, [C], T0 + CDN_CANDIDATE_TTL_MS)).toEqual([C])
  })

  it('被罚的主机即使是调用方给的第一条也要挪到队尾', () => {
    reportCdnFailure(A, 'blocked', T0)

    expect(resolveCdnCandidates(KEY, [A, B], T0 + 1)).toEqual([B, A])
  })

  it('资源键为空串时只排序，不记账', () => {
    expect(resolveCdnCandidates('', [A, B, A], T0)).toEqual([A, B])

    expect(getCdnRegistrySnapshot(T0).resources).toBe(0)
    expect(getCdnCandidates('', T0)).toEqual([])
  })

  it('资源键为空串时仍然享受主机健康那一层', () => {
    reportCdnFailure(A, 'blocked', T0)

    expect(resolveCdnCandidates('', [A, B], T0 + 1)).toEqual([B, A])
  })

  it('不同资源键之间互不串味 —— 键必须由调用方给就是为了这个', () => {
    resolveCdnCandidates('bili:BV1aaa:video', [A], T0)

    expect(resolveCdnCandidates('bili:BV1bbb:video', [B], T0)).toEqual([B])
  })

  it('一条可用地址都没有时返回空数组，且不记账', () => {
    expect(resolveCdnCandidates(KEY, ['', 'not a url', null], T0)).toEqual([])
    expect(getCdnRegistrySnapshot(T0).resources).toBe(0)
  })
})

describe('getCdnCandidates', () => {
  it('没记过返回空数组', () => {
    expect(getCdnCandidates(KEY, T0)).toEqual([])
  })

  it('取的时候按当下的主机健康重排，而不是发回入库时的次序', () => {
    rememberCdnCandidates(KEY, [A, B], T0)
    reportCdnFailure(A, 'blocked', T0 + 1000)

    expect(getCdnCandidates(KEY, T0 + 2000)).toEqual([B, A])
  })

  it('过期即删，不是只返回空', () => {
    rememberCdnCandidates(KEY, [A, B], T0)

    expect(getCdnCandidates(KEY, T0 + CDN_CANDIDATE_TTL_MS)).toEqual([])
    expect(getCdnRegistrySnapshot(T0).resources).toBe(0)
  })
})

describe('rememberCdnCandidates', () => {
  it('返回值就是排序后的清单，记账和排序是同一次调用的两个产物', () => {
    reportCdnFailure(A, 'blocked', T0)

    expect(rememberCdnCandidates(KEY, [A, B], T0 + 1)).toEqual([B, A])
    expect(getCdnCandidates(KEY, T0 + 1)).toEqual([B, A])
  })

  it('空键或空清单不建条目', () => {
    expect(rememberCdnCandidates('', [A], T0)).toEqual([A])
    expect(rememberCdnCandidates(KEY, [], T0)).toEqual([])
    expect(getCdnRegistrySnapshot(T0).resources).toBe(0)
  })

  it('存的是副本，调用方之后改数组不影响地址簿', () => {
    const input = [A, B]
    rememberCdnCandidates(KEY, input, T0)
    input.push(C)

    expect(getCdnCandidates(KEY, T0)).toEqual([A, B])
  })
})

describe('LRU 淘汰', () => {
  it('主机数不超过 CDN_REGISTRY_CAPACITY，超了淘汰最久未用的', () => {
    for (let index = 0; index < CDN_REGISTRY_CAPACITY; index += 1) {
      reportCdnFailure(nodeUrl(index), 'network', T0)
    }
    expect(getCdnRegistrySnapshot(T0 + 1).hosts).toBe(CDN_REGISTRY_CAPACITY)

    reportCdnFailure(nodeUrl(CDN_REGISTRY_CAPACITY), 'network', T0)

    expect(getCdnRegistrySnapshot(T0 + 1).hosts).toBe(CDN_REGISTRY_CAPACITY)
    // 队首那个被挤掉，于是它的惩罚也跟着没了
    expect(isCdnHostPenalized(nodeUrl(0), T0 + 1)).toBe(false)
    expect(isCdnHostPenalized(nodeUrl(1), T0 + 1)).toBe(true)
    expect(isCdnHostPenalized(nodeUrl(CDN_REGISTRY_CAPACITY), T0 + 1)).toBe(true)
  })

  it('同一个主机反复失败不占额度', () => {
    for (let index = 0; index < CDN_REGISTRY_CAPACITY + 10; index += 1) {
      reportCdnFailure(A, 'blocked', T0 + index)
    }

    expect(getCdnRegistrySnapshot(T0 + CDN_REGISTRY_CAPACITY).hosts).toBe(1)
  })

  it('候选清单数不超过 CDN_REGISTRY_CAPACITY', () => {
    for (let index = 0; index < CDN_REGISTRY_CAPACITY; index += 1) {
      rememberCdnCandidates(`res:${index}`, [nodeUrl(index)], T0)
    }
    expect(getCdnRegistrySnapshot(T0).resources).toBe(CDN_REGISTRY_CAPACITY)

    rememberCdnCandidates('res:new', [A], T0)

    expect(getCdnRegistrySnapshot(T0).resources).toBe(CDN_REGISTRY_CAPACITY)
    expect(getCdnCandidates('res:0', T0)).toEqual([])
    expect(getCdnCandidates('res:new', T0)).toEqual([A])
  })

  it('读一次会把资源挪到队尾，下一轮淘汰就轮不到它', () => {
    for (let index = 0; index < CDN_REGISTRY_CAPACITY; index += 1) {
      rememberCdnCandidates(`res:${index}`, [nodeUrl(index)], T0)
    }
    // 队首的 res:0 被读了一次
    expect(getCdnCandidates('res:0', T0)).toEqual([nodeUrl(0)])

    rememberCdnCandidates('res:new', [A], T0)

    expect(getCdnCandidates('res:0', T0)).toEqual([nodeUrl(0)])
    // 换成 res:1 顶上队首被挤掉
    expect(getCdnCandidates('res:1', T0)).toEqual([])
  })
})

describe('getCdnRegistrySnapshot', () => {
  it('只给数字和只读快照，不给能反过来改状态的句柄', () => {
    reportCdnFailure(A, 'blocked', T0)
    const snapshot = getCdnRegistrySnapshot(T0 + 1)

    expect(snapshot).toEqual({
      resources: 0,
      hosts: 1,
      penalized: [{
        host: 'upos-sz-mirrorcos.bilivideo.com',
        failures: 1,
        lastKind: 'blocked',
        penaltyRemainingMs: CDN_HOST_PENALTY_MS - 1
      }]
    })
  })

  it('惩罚期外的主机算进 hosts 但不进 penalized', () => {
    reportCdnFailure(A, 'blocked', T0)
    reportCdnFailure(B, 'missing', T0)
    reportCdnSuccess(A)

    const snapshot = getCdnRegistrySnapshot(T0 + 1)
    expect(snapshot.hosts).toBe(2)
    expect(snapshot.penalized.map(entry => entry.host)).toEqual(['upos-sz-mirrorbd.bilivideo.com'])
  })

  it('penalized 按主机名排序，和记账次序无关', () => {
    reportCdnFailure(upos('zzz'), 'blocked', T0)
    reportCdnFailure(upos('aaa'), 'blocked', T0)
    reportCdnFailure(upos('mmm'), 'blocked', T0)

    expect(getCdnRegistrySnapshot(T0 + 1).penalized.map(entry => entry.host)).toEqual([
      'upos-sz-mirroraaa.bilivideo.com',
      'upos-sz-mirrormmm.bilivideo.com',
      'upos-sz-mirrorzzz.bilivideo.com'
    ])
  })

  it('顺手清掉过期的候选清单 —— 把过期的算进 resources 是误导', () => {
    rememberCdnCandidates(KEY, [A], T0)

    expect(getCdnRegistrySnapshot(T0 + CDN_CANDIDATE_TTL_MS).resources).toBe(0)
    // 真删了，不是只在这一次的返回值里少算
    expect(getCdnRegistrySnapshot(T0).resources).toBe(0)
  })
})

describe('readErrorStatus', () => {
  it('认外部下载器那种裸 status', () => {
    expect(readErrorStatus({ status: 403 })).toBe(403)
    expect(readErrorStatus(Object.assign(new Error('boom'), { status: 404 }))).toBe(404)
  })

  it('认 axios 那种 response.status', () => {
    expect(readErrorStatus({ response: { status: 403, data: 'forbidden' } })).toBe(403)
    expect(readErrorStatus(Object.assign(new Error('boom'), { response: { status: 410 } }))).toBe(410)
  })

  it('两种都有时裸 status 优先', () => {
    expect(readErrorStatus({ status: 403, response: { status: 500 } })).toBe(403)
  })

  it.each([
    ['字符串状态码', { status: '403' }],
    ['response 不是对象', { response: 403 }],
    ['response.status 是字符串', { response: { status: '403' } }],
    ['没有状态码', { code: 'ECONNRESET' }],
    ['空对象', {}],
    ['数组', [{ status: 403 }]],
    ['null', null],
    ['undefined', undefined],
    ['字符串', 'Request failed with status code 403'],
    ['数字', 403]
  ])('%s 取不到状态码', (_label, error) => {
    expect(readErrorStatus(error)).toBeUndefined()
  })
})

describe('classifyCdnFailure', () => {
  it.each([
    [401, 'blocked'],
    [403, 'blocked'],
    [404, 'missing'],
    [410, 'missing']
  ])('%d 认定成这个节点的问题（%s）', (status, kind) => {
    expect(classifyCdnFailure({ status })).toBe(kind)
    expect(classifyCdnFailure({ response: { status } })).toBe(kind)
  })

  it.each([
    ['429 限流按 IP 算，换节点照样被限', 429],
    ['500 源站问题，所有镜像回同一个源', 500],
    ['502', 502],
    ['503', 503],
    ['504', 504],
    ['400', 400],
    ['200', 200]
  ])('%s → 不换地址', (_label, status) => {
    expect(classifyCdnFailure({ status })).toBeNull()
  })

  it.each([
    ['DNS 解析不出来', 'ENOTFOUND'],
    ['DNS 临时失败', 'EAI_AGAIN'],
    ['连接被拒', 'ECONNREFUSED'],
    ['主机不可达', 'EHOSTUNREACH']
  ])('%s（%s）→ network', (_label, code) => {
    expect(classifyCdnFailure({ code })).toBe('network')
    expect(classifyCdnFailure(Object.assign(new Error('boom'), { code }))).toBe('network')
  })

  it.each([
    ['本地超时', 'ETIMEDOUT'],
    ['取消', 'ERR_CANCELED'],
    ['断流', 'ECONNRESET'],
    ['低速中断', 'KKK_SLOW_DOWNLOAD_ABORT'],
    ['不认识的码', 'EWHATEVER'],
    ['空码', '']
  ])('%s（%s）→ 不换地址', (_label, code) => {
    expect(classifyCdnFailure({ code })).toBeNull()
  })

  it('有状态码时就不看 code —— 状态码是更强的证据', () => {
    // 500 配 ENOTFOUND 这种形状真实存在（代理把上游错误包成 5xx 再附上自己的 code），
    // 此时该信的是「源站有问题」而不是「DNS 挂了」
    expect(classifyCdnFailure({ status: 500, code: 'ENOTFOUND' })).toBeNull()
    expect(classifyCdnFailure({ status: 403, code: 'ETIMEDOUT' })).toBe('blocked')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['字符串', 'ENOTFOUND'],
    ['数字', 403],
    ['数组', ['ENOTFOUND']],
    ['空对象', {}],
    ['裸 Error', new Error('boom')],
    ['code 是数字', { code: 111 }]
  ])('%s → 不换地址', (_label, error) => {
    expect(classifyCdnFailure(error)).toBeNull()
  })
})

describe('两层记忆的寿命关系', () => {
  it('主机惩罚期比候选清单活得久 —— 前者攒的是跨作品的经验', () => {
    expect(CDN_HOST_PENALTY_MS).toBeGreaterThan(CDN_CANDIDATE_TTL_MS)
  })

  it('候选清单 TTL 对齐 ApiCache 的 detail 档（上游重签直链的周期）', () => {
    expect(CDN_CANDIDATE_TTL_MS).toBe(5 * 60 * 1000)
  })

  it('惩罚期是分钟级，不长到把已恢复的好节点一直摁在队尾', () => {
    expect(CDN_HOST_PENALTY_MS).toBe(10 * 60 * 1000)
    expect(CDN_HOST_PENALTY_MS).toBeLessThan(30 * 60 * 1000)
  })
})
