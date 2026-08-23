import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * userAgent.ts 的回归测试。
 *
 * 这个模块修的 bug（5408cd8）性质是**静默失效**：写错了不报错、不抛异常、测试不红，
 * 只会让线上偶发 B站 gaia 风控（-352）。所以行为必须被断言锁住，而不是靠读代码复核。
 *
 * 机理（详见 src/module/platform/common/userAgent.ts 的 JSDoc）：
 * amagi 组装请求头的最后一步是 `headers: { ...defHeaders, ...requestConfig?.headers ?? {} }`，
 * 我们传的 `User-Agent` key 一旦存在就会覆盖 amagi 随版本更新的内置 UA；
 * 而 amagi 的 `Sec-Ch-Ua` 是**从 UA 派生**的，UA 落后会让整组客户端提示自相矛盾。
 * amagi 还是**按平台分别维护** UA 的，所以阈值必须按平台取。
 */

/**
 * 只把 Config 换成可变的替身。
 * userAgent.ts 是在函数体内才读 `Config.request` 的（不是模块加载期快照），
 * 所以每个用例直接改 configMock.request 就够，不需要 resetModules 重新 import。
 */
const configMock = vi.hoisted(() => ({
  request: {} as Record<string, unknown> | undefined
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

const { buildSharedUserAgentHeader, buildUserAgentHeader } = await import(
  '../../src/module/platform/common/userAgent.js'
)

/**
 * amagi 6.5.0 各平台内置 UA 的 Chrome 主版本号。
 * 这里刻意重写一份而不是从 src 导出复用：常量表被改动时这组断言要跟着报错，
 * 而不是「测试和实现一起漂移、双方永远自洽」。
 */
const AMAGI_BUILTIN = {
  douyin: 125,
  bilibili: 142,
  kuaishou: 130,
  xiaohongshu: 141
} as const

type Platform = keyof typeof AMAGI_BUILTIN

/** 按字母序固定顺序，方便整组比较 */
const PLATFORMS: Platform[] = ['bilibili', 'douyin', 'kuaishou', 'xiaohongshu']

/** 造一条桌面版 Chrome UA */
const chromeUA = (major: number): string =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`

/** 把 request.yaml 里的 User-Agent 设成任意值（含非字符串），模拟用户手改过的配置 */
const setConfiguredUA = (value: unknown): void => {
  configMock.request = { timeout: 15000, 'User-Agent': value }
}

/**
 * 「不覆盖」的断言。
 *
 * 防的回归就是 JSDoc 里点名的那个坑：返回值绝不能是 `{ 'User-Agent': undefined }`。
 * 那个形状仍然会参与 amagi 的 spread，把 amagi 自己的 UA 打成显式 undefined，
 * axios 于是发出 `axios/<版本>` 或干脆不带 UA —— 比 UA 落后更容易触发风控。
 *
 * 注意这里必须用 toStrictEqual 而不是 toEqual：toEqual 会忽略值为 undefined 的 key，
 * `{ 'User-Agent': undefined }` 能骗过 `toEqual({})`。`'User-Agent' in result` 是
 * 唯一不会被 undefined 糊弄过去的检查，所以三条断言都留着。
 */
const expectNoOverride = (result: Record<string, string>): void => {
  expect(result).toStrictEqual({})
  expect('User-Agent' in result).toBe(false)
  expect(Object.keys(result)).toStrictEqual([])
}

/** 「覆盖」的断言：必须是且只是配置里那个值，一字不改 */
const expectOverride = (result: Record<string, string>, expected: string): void => {
  expect(result).toStrictEqual({ 'User-Agent': expected })
  expect('User-Agent' in result).toBe(true)
}

/** 在给定 Chrome 主版本号下，会被覆盖的平台集合（字母序） */
const platformsThatOverride = (major: number): Platform[] => {
  setConfiguredUA(chromeUA(major))
  return PLATFORMS.filter(platform => 'User-Agent' in buildUserAgentHeader(platform))
}

beforeEach(() => {
  configMock.request = {}
})

describe('buildUserAgentHeader 决定是否覆盖 amagi 的内置 UA', () => {
  describe('按平台阈值比较 Chrome 主版本号', () => {
    it.each(PLATFORMS.map(platform => [platform, AMAGI_BUILTIN[platform]] as const))(
      '%s 的阈值是 Chrome/%i：更新的版本用配置值覆盖',
      (platform, builtin) => {
        const ua = chromeUA(builtin + 1)
        setConfiguredUA(ua)

        expectOverride(buildUserAgentHeader(platform), ua)
      }
    )

    it.each(PLATFORMS.map(platform => [platform, AMAGI_BUILTIN[platform]] as const))(
      '%s 的阈值是 Chrome/%i：更旧的版本返回空对象，把决定权交回 amagi',
      (platform, builtin) => {
        setConfiguredUA(chromeUA(builtin - 1))

        // 交回 amagi 是「安全的那一侧」：amagi 的 UA 和 Sec-Ch-Ua 永远是配对的
        expectNoOverride(buildUserAgentHeader(platform))
      }
    )

    it.each(PLATFORMS.map(platform => [platform, AMAGI_BUILTIN[platform]] as const))(
      '%s 的阈值是 Chrome/%i：版本【恰好相等时会覆盖】—— 判断是 configuredMajor < 阈值，相等不成立',
      (platform, builtin) => {
        const ua = chromeUA(builtin)
        setConfiguredUA(ua)

        // 明确锁住当前行为：相等 → 覆盖。
        // 相等时两边 Chrome 主版本一致，Sec-Ch-Ua 不会自相矛盾，所以覆盖是无害的；
        // 但这是「行为选择」而不是「显然正确」，一旦有人把 `<` 改成 `<=` 这里必须红。
        expectOverride(buildUserAgentHeader(platform), ua)
      }
    )

    it('配置版本远高于所有平台内置值时，四个平台一律覆盖', () => {
      const ua = chromeUA(999)
      setConfiguredUA(ua)

      for (const platform of PLATFORMS) {
        expectOverride(buildUserAgentHeader(platform), ua)
      }
    })

    it('配置版本远低于所有平台内置值时，四个平台一律不覆盖', () => {
      setConfiguredUA(chromeUA(1))

      for (const platform of PLATFORMS) {
        expectNoOverride(buildUserAgentHeader(platform))
      }
    })
  })

  /**
   * 这一组是防「单一常量阈值」回归的核心。
   *
   * 早先这个模块用单一常量 125（douyin 的值）当阈值，于是 B站（内置 142）在用户配置为
   * 125 时判断 `125 < 125` 为假、照样覆盖 —— 模块想防的事在 B站 上又发生了一遍。
   * 只要有人把 AMAGI_BUILTIN_CHROME_MAJOR 折叠回一个数字，这一组必须整片报错。
   */
  describe('同一个配置值在不同平台得出不同结论（防「单一常量阈值」回归）', () => {
    it('Chrome/130 对 douyin(125)/kuaishou(130) 覆盖，对 xiaohongshu(141)/bilibili(142) 不覆盖', () => {
      const ua = chromeUA(130)
      setConfiguredUA(ua)

      // 同一个配置值、同一次调用形状，结论只由平台决定 —— 这就是「阈值必须按平台取」
      expectOverride(buildUserAgentHeader('douyin'), ua)
      expectOverride(buildUserAgentHeader('kuaishou'), ua)
      expectNoOverride(buildUserAgentHeader('xiaohongshu'))
      expectNoOverride(buildUserAgentHeader('bilibili'))
    })

    it('Chrome/125 是 5408cd8 修掉的原始现场：douyin 覆盖而 bilibili 必须不覆盖', () => {
      // 实测有用户的 request.yaml 锁着 Chrome/125（本仓库 2024 年发过的 default 值），
      // 单一常量 125 的版本会让 bilibili 也走进覆盖分支，UA 落后 17 个大版本、
      // 而 Sec-Ch-Ua 由 amagi 从这个落后的 UA 派生 —— 指纹自相矛盾，撞 gaia -352。
      const ua = chromeUA(125)
      setConfiguredUA(ua)

      expectNoOverride(buildUserAgentHeader('bilibili'))
      expectOverride(buildUserAgentHeader('douyin'), ua)
    })

    it('Chrome/124…142 逐级放开覆盖范围，四个平台各自在自己的阈值处翻转', () => {
      // 四个阈值互不相同（125/130/141/142），所以覆盖集合是严格递增的几个不同快照。
      // 任何把阈值统一成一个数字的改动都会让下面至少三行同时崩掉。
      expect(platformsThatOverride(124)).toStrictEqual([])
      expect(platformsThatOverride(125)).toStrictEqual(['douyin'])
      expect(platformsThatOverride(129)).toStrictEqual(['douyin'])
      expect(platformsThatOverride(130)).toStrictEqual(['douyin', 'kuaishou'])
      expect(platformsThatOverride(140)).toStrictEqual(['douyin', 'kuaishou'])
      expect(platformsThatOverride(141)).toStrictEqual(['douyin', 'kuaishou', 'xiaohongshu'])
      expect(platformsThatOverride(142)).toStrictEqual(['bilibili', 'douyin', 'kuaishou', 'xiaohongshu'])
    })

    it('存在把四个平台切成两派的版本号 —— 单一常量实现下这不可能成立', () => {
      // 换个角度锁同一件事：单一常量下任何版本号都只能得到「全覆盖」或「全不覆盖」，
      // 即 0 或 4，绝不会出现 1/2/3 这种部分覆盖。
      const splits = [125, 130, 141].map(major => platformsThatOverride(major).length)

      expect(splits).toStrictEqual([1, 2, 3])
    })
  })

  describe('配置值缺失或不是字符串时一律不覆盖', () => {
    it('空串不覆盖', () => {
      setConfiguredUA('')

      expectNoOverride(buildUserAgentHeader('bilibili'))
    })

    it.each([' ', '   ', '\t', '\n', ' \t\n '])(
      '只有空白的配置值（%j）不覆盖',
      blank => {
        // 防的回归：`if (!configured)` 挡不住 '   '，空白 UA 发出去等于没有 UA
        setConfiguredUA(blank)

        expectNoOverride(buildUserAgentHeader('bilibili'))
      }
    )

    it('值为 undefined 不覆盖（这是最危险的输入，直接透传会变成显式 undefined）', () => {
      setConfiguredUA(undefined)

      expectNoOverride(buildUserAgentHeader('bilibili'))
    })

    it('配置里根本没有 User-Agent 这个 key 时不覆盖', () => {
      configMock.request = { timeout: 15000 }

      expectNoOverride(buildUserAgentHeader('bilibili'))
    })

    it('Config.request 整体缺失时不覆盖也不抛异常', () => {
      // request.yaml 缺失/读不出来时 Config.request 可能是 undefined，
      // 这里必须靠可选链兜住，不能让一次配置异常连带打挂所有请求
      configMock.request = undefined

      expect(() => buildUserAgentHeader('bilibili')).not.toThrow()
      expectNoOverride(buildUserAgentHeader('bilibili'))
    })

    it.each([
      ['null', null],
      ['数字', 142],
      ['布尔值', true],
      ['数组', ['Chrome/999']],
      ['对象', { 'User-Agent': 'Chrome/999' }]
    ])('非字符串配置值（%s）不覆盖', (_label, value) => {
      // 防的回归：yaml 里写成 `User-Agent: 142` 之类的类型事故不能被塞进请求头，
      // 非字符串进了 axios headers 会是难查的运行期怪状
      setConfiguredUA(value)

      expectNoOverride(buildUserAgentHeader('bilibili'))
    })
  })

  describe('认不出 Chrome 版本号时尊重用户设置', () => {
    it.each([
      ['iOS Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'],
      ['iOS Chrome（是 CriOS 而非 Chrome）', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1'],
      ['Firefox', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0'],
      ['抖音 App 内置 WebView', 'com.ss.android.ugc.aweme/300904 (Linux; U; Android 13; zh_CN; Build/QP1A)'],
      ['纯自定义字符串', 'kkk-custom-agent'],
      ['Chrome/ 后面不是数字', 'Mozilla/5.0 Chrome/stable Safari/537.36']
    ])('%s 这类 UA 读不出主版本号，原样交给 amagi 覆盖', (_label, ua) => {
      // 认不出版本号说明用户是刻意配的（移动端 / App WebView / 自定义指纹），
      // 这时候我们没有可比较的依据，硬套阈值会把用户的设置默默吞掉
      setConfiguredUA(ua)

      for (const platform of PLATFORMS) {
        expectOverride(buildUserAgentHeader(platform), ua)
      }
    })

    it('带 Chrome 版本号的安卓移动端 UA【会走版本比较】而不是被当成自定义 UA', () => {
      // 锁住当前行为，也标出一处值得注意的不对称：
      // 安卓版 Chrome 的 UA 里确实带 `Chrome/<版本>`，所以刻意配的安卓 UA 只要版本偏低
      // 就会被静默丢弃、回落到 amagi 的桌面 UA —— 和上一条 iOS/WebView 的待遇不一样。
      setConfiguredUA('Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36')

      expectNoOverride(buildUserAgentHeader('bilibili'))
      expectNoOverride(buildUserAgentHeader('douyin'))
    })

    it('Edge 这类壳仍按内嵌的 Chrome 版本号比较', () => {
      const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
      setConfiguredUA(edge)

      expectOverride(buildUserAgentHeader('douyin'), edge)
      expectNoOverride(buildUserAgentHeader('bilibili'))
    })

    it('覆盖时返回的是配置里那个字符串本身，不做裁剪或规范化', () => {
      // 防的回归：任何「顺手 trim/补全/改写 UA」的改动都会让指纹和用户预期不一致。
      // 注意首尾空白也被原样保留 —— 只有「全是空白」才会被判成空值。
      const padded = `  ${chromeUA(999)}  `
      setConfiguredUA(padded)

      expectOverride(buildUserAgentHeader('douyin'), padded)
    })
  })

  describe('返回值形状：绝不能出现 { "User-Agent": undefined }', () => {
    it.each([
      ['undefined', undefined],
      ['空串', ''],
      ['纯空白', '   '],
      ['null', null],
      ['数字', 125],
      ['版本偏旧的 UA', chromeUA(100)]
    ])('%s 时返回值里不存在 User-Agent 这个 key（不是「值为 falsy」）', (_label, value) => {
      // 这是整个模块最关键的一条不变量。amagi 的最后一步 spread 只看 key 在不在，
      // `{ 'User-Agent': undefined }` 照样把 amagi 的值打掉，然后 axios 发出自己的
      // `axios/<版本>` 或不带 UA。所以断言的是 `in`，而不是值 falsy —— 后者两种形状都通过。
      setConfiguredUA(value)
      const result = buildUserAgentHeader('bilibili')

      expect('User-Agent' in result).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(result, 'User-Agent')).toBe(false)
      expect(Object.keys(result)).toStrictEqual([])
      // 再证一遍这个形状真能被 spread 安全吞掉：合并进去不会污染上游的 UA
      expect({ 'User-Agent': 'amagi-builtin', ...result }['User-Agent']).toBe('amagi-builtin')
    })

    it('覆盖分支合并进 amagi 请求头时才会替掉上游的 UA', () => {
      const ua = chromeUA(999)
      setConfiguredUA(ua)

      // 覆盖分支的语义同样用 spread 验证，两个分支合起来才是完整契约
      expect({ 'User-Agent': 'amagi-builtin', ...buildUserAgentHeader('bilibili') }['User-Agent']).toBe(ua)
    })
  })
})

describe('buildSharedUserAgentHeader 四平台共用客户端的 UA 决策', () => {
  it('取四个平台里最高的阈值（bilibili 的 142），中间版本 Chrome/135 不覆盖', () => {
    // 防的回归：这个 Client 把四个平台的 cookie 一起传进去，一次请求走哪个平台在
    // 调用点不可知，所以必须用最高阈值。Chrome/135 高于 douyin(125)/kuaishou(130)、
    // 低于 bilibili(142) —— 如果实现退回「取第一个平台」或「取最低阈值」，这条会红。
    setConfiguredUA(chromeUA(135))

    expectNoOverride(buildSharedUserAgentHeader())
  })

  it('高于所有平台内置值的 Chrome/150 才覆盖', () => {
    const ua = chromeUA(150)
    setConfiguredUA(ua)

    expectOverride(buildSharedUserAgentHeader(), ua)
  })

  it('Chrome/141 差一版就不覆盖，Chrome/142 恰好等于最高阈值则覆盖', () => {
    setConfiguredUA(chromeUA(141))
    expectNoOverride(buildSharedUserAgentHeader())

    const atThreshold = chromeUA(142)
    setConfiguredUA(atThreshold)
    expectOverride(buildSharedUserAgentHeader(), atThreshold)
  })

  it('结论恒等于阈值最高那个平台（bilibili）的结论', () => {
    // 直接把「最高阈值」这件事表达成等式，比逐个版本号断言更难被绕过
    for (const major of [1, 124, 125, 130, 135, 141, 142, 143, 999]) {
      setConfiguredUA(chromeUA(major))

      expect(buildSharedUserAgentHeader()).toStrictEqual(buildUserAgentHeader('bilibili'))
    }
  })

  it('在 douyin 会覆盖的 Chrome/130 上，共用客户端必须仍不覆盖', () => {
    // 共用实例偏保守的一侧同样是「让 amagi 自己决定」
    const ua = chromeUA(130)
    setConfiguredUA(ua)

    expectOverride(buildUserAgentHeader('douyin'), ua)
    expectNoOverride(buildSharedUserAgentHeader())
  })

  it.each([
    ['undefined', undefined],
    ['空串', ''],
    ['纯空白', '  '],
    ['非字符串', 142]
  ])('配置值无效（%s）时返回空对象且不含 User-Agent 这个 key', (_label, value) => {
    setConfiguredUA(value)

    expectNoOverride(buildSharedUserAgentHeader())
  })

  it('认不出版本号的自定义 UA 在共用客户端上同样被尊重', () => {
    const ua = 'kkk-custom-shared-agent'
    setConfiguredUA(ua)

    expectOverride(buildSharedUserAgentHeader(), ua)
  })
})
