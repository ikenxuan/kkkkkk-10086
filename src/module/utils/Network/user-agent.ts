import os from 'node:os'
import type { AxiosRequestConfig } from 'axios'

interface WeightedUserAgent {
  ua: string
  pct: number
}

const userAgentsByPlatform: Record<'windows' | 'mac' | 'linux', WeightedUserAgent[]> = {
  windows: [
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', pct: 17.34 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0', pct: 2.48 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0', pct: 2.48 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 OPR/117.0.0.0', pct: 2.48 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Trailer/93.3.8652.5', pct: 2.48 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0', pct: 1.24 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0', pct: 1.24 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36', pct: 1.24 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19582', pct: 1.24 }
  ],
  mac: [
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.10 Safari/605.1.15', pct: 43.03 },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36', pct: 21.05 }
  ],
  linux: [
    { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', pct: 3.72 },
    { ua: 'Mozilla/5.0 (X11; Linux i686; rv:136.0) Gecko/20100101 Firefox/136.0', pct: 3.6 }
  ]
}

export const getRandomUserAgent = (): string => {
  const agents = os.platform() === 'win32'
    ? userAgentsByPlatform.windows
    : os.platform() === 'darwin'
      ? userAgentsByPlatform.mac
      : userAgentsByPlatform.linux
  const totalWeight = agents.reduce((sum, agent) => sum + agent.pct, 0)
  let random = Math.random() * totalWeight
  const found = agents.find(agent => (random -= agent.pct) <= 0)
  return found?.ua || agents[0]?.ua || ''
}

export const baseHeaders: AxiosRequestConfig['headers'] = {
  Accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'User-Agent': getRandomUserAgent()
}
