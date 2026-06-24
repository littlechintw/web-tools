export function parseIp(s: string): number | null {
  const parts = s.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const v = Number(part)
    if (v > 255) return null
    n = (n << 8) | v
  }
  return n >>> 0
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.')
}

export function ipClass(firstOctet: number): string {
  if (firstOctet < 128) return 'A'
  if (firstOctet < 192) return 'B'
  if (firstOctet < 224) return 'C'
  if (firstOctet < 240) return 'D (multicast)'
  return 'E (reserved)'
}

export interface SubnetResult {
  network: string
  broadcast: string
  netmask: string
  wildcard: string
  firstHost: string
  lastHost: string
  totalHosts: number
  usableHosts: number
  ipClass: string
}

export function calcSubnet(ipStr: string, prefix: number): SubnetResult | null {
  const ip = parseIp(ipStr)
  if (ip === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const wildcard = (~mask) >>> 0
  const network = (ip & mask) >>> 0
  const broadcast = (network | wildcard) >>> 0

  const total = prefix >= 32 ? 1 : 2 ** (32 - prefix)
  let usable: number
  let firstHost: string
  let lastHost: string

  if (prefix >= 31) {
    usable = prefix === 32 ? 1 : 2
    firstHost = intToIp(network)
    lastHost = intToIp(broadcast)
  } else {
    usable = total - 2
    firstHost = intToIp((network + 1) >>> 0)
    lastHost = intToIp((broadcast - 1) >>> 0)
  }

  return {
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    netmask: intToIp(mask),
    wildcard: intToIp(wildcard),
    firstHost,
    lastHost,
    totalHosts: total,
    usableHosts: usable,
    ipClass: ipClass((ip >>> 24) & 0xff),
  }
}
