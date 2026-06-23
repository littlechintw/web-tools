// Lightweight, dependency-free User-Agent parser.
// Covers the common browsers / engines / OSes / device hints. This is a
// best-effort heuristic parser (UA strings are inherently unreliable) and
// intentionally avoids a large external regex database.

export interface UAResult {
  browser: { name?: string; version?: string }
  engine: { name?: string; version?: string }
  os: { name?: string; version?: string }
  device: { vendor?: string; model?: string; type?: string }
  cpu: { architecture?: string }
}

function match(ua: string, re: RegExp): RegExpMatchArray | null {
  return ua.match(re)
}

function parseBrowser(ua: string): { name?: string; version?: string } {
  // Order matters: more specific brands first (they also contain Chrome/Safari).
  const tests: [string, RegExp][] = [
    ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ['Opera', /(?:OPR|Opera)\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Vivaldi', /Vivaldi\/([\d.]+)/],
    ['Brave', /Brave\/([\d.]+)/],
    ['Yandex', /YaBrowser\/([\d.]+)/],
    ['UC Browser', /UCBrowser\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
    ['Internet Explorer', /(?:MSIE |rv:)([\d.]+)/],
  ]
  for (const [name, re] of tests) {
    const m = match(ua, re)
    if (m) return { name, version: m[1] }
  }
  // Generic fallback: first "Name/version" token.
  const generic = match(ua, /([A-Za-z]+)\/([\d.]+)/)
  if (generic) return { name: generic[1], version: generic[2] }
  return {}
}

function parseEngine(ua: string): { name?: string; version?: string } {
  const tests: [string, RegExp][] = [
    ['EdgeHTML', /Edge\/([\d.]+)/],
    ['Blink', /Chrome\/([\d.]+)/],
    ['Gecko', /rv:([\d.]+)\) Gecko/],
    ['WebKit', /AppleWebKit\/([\d.]+)/],
    ['Trident', /Trident\/([\d.]+)/],
    ['Presto', /Presto\/([\d.]+)/],
  ]
  for (const [name, re] of tests) {
    const m = match(ua, re)
    if (m) return { name, version: m[1] }
  }
  return {}
}

function parseOS(ua: string): { name?: string; version?: string } {
  let m: RegExpMatchArray | null
  if ((m = match(ua, /Windows NT ([\d.]+)/))) {
    const map: Record<string, string> = {
      '10.0': '10/11',
      '6.3': '8.1',
      '6.2': '8',
      '6.1': '7',
      '6.0': 'Vista',
      '5.1': 'XP',
    }
    return { name: 'Windows', version: map[m[1]] ?? m[1] }
  }
  if ((m = match(ua, /iPhone OS ([\d_]+)/)) || (m = match(ua, /CPU OS ([\d_]+)/)))
    return { name: 'iOS', version: m[1].replace(/_/g, '.') }
  if ((m = match(ua, /Mac OS X ([\d_]+)/)))
    return { name: 'macOS', version: m[1].replace(/_/g, '.') }
  if (/Android/.test(ua)) {
    m = match(ua, /Android ([\d.]+)/)
    return { name: 'Android', version: m ? m[1] : undefined }
  }
  if (/CrOS/.test(ua)) return { name: 'Chrome OS' }
  if (/Linux/.test(ua)) return { name: 'Linux' }
  return {}
}

function parseDevice(ua: string): { vendor?: string; model?: string; type?: string } {
  if (/iPad/.test(ua)) return { vendor: 'Apple', model: 'iPad', type: 'tablet' }
  if (/iPhone/.test(ua)) return { vendor: 'Apple', model: 'iPhone', type: 'mobile' }
  if (/Android/.test(ua)) {
    const tablet = !/Mobile/.test(ua)
    const m = match(ua, /;\s?([^;)]+)\s+Build\//)
    return { model: m ? m[1].trim() : undefined, type: tablet ? 'tablet' : 'mobile' }
  }
  if (/Mobile/.test(ua)) return { type: 'mobile' }
  return { type: 'desktop' }
}

function parseCPU(ua: string): { architecture?: string } {
  if (/(?:x86_64|Win64|WOW64|x64|amd64)/.test(ua)) return { architecture: 'amd64' }
  if (/(?:arm64|aarch64)/.test(ua)) return { architecture: 'arm64' }
  if (/(?:arm)/i.test(ua)) return { architecture: 'arm' }
  if (/(?:i686|i386|x86)/.test(ua)) return { architecture: 'ia32' }
  return {}
}

export function UAParser(ua: string): UAResult {
  return {
    browser: parseBrowser(ua),
    engine: parseEngine(ua),
    os: parseOS(ua),
    device: parseDevice(ua),
    cpu: parseCPU(ua),
  }
}
