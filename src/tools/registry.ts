import type { CategoryId, LocalizedText, RegisteredTool, ToolMeta, ToolMessages } from '@/types'

// Eagerly load every tool's metadata. Each tool folder must contain a
// `tool.ts` exporting `meta` (and optionally `messages`).
const metaModules = import.meta.glob<{ meta: ToolMeta; messages?: ToolMessages }>(
  './*/tool.ts',
  { eager: true },
)

// Lazy component loaders, matched to tools by folder name.
const viewModules = import.meta.glob('./*/View.vue')

function folderOf(path: string): string {
  // './base64/tool.ts' -> 'base64'
  return path.split('/')[1]
}

const tools: RegisteredTool[] = []

for (const [path, mod] of Object.entries(metaModules)) {
  const folder = folderOf(path)
  const meta = mod.meta
  if (!meta) {
    console.warn(`[registry] ${path} is missing a 'meta' export, skipping.`)
    continue
  }
  const viewPath = `./${folder}/View.vue`
  const component = viewModules[viewPath]
  if (!component) {
    console.warn(`[registry] ${meta.id}: no View.vue found at ${viewPath}, skipping.`)
    continue
  }
  tools.push({ ...meta, component })
}

// Global "usefulness" ranking — most practical/everyday tools first. The home
// page grid and the in-category sidebar order both follow this. Tools not listed
// here fall to the end (alphabetically). Tweak the order here, in one place.
const POPULARITY: string[] = [
  'json-format',
  'base64',
  'qrcode-generate',
  'timestamp',
  'url-encode',
  'hash',
  'password-generator',
  'uuid',
  'color-convert',
  'case-convert',
  'text-diff',
  'json-convert',
  'jwt-decode',
  'markdown-preview',
  'regex-tester',
  'qr-scan',
  'number-base',
  'unit-convert',
  'date-calc',
  'cron-parser',
  'text-stats',
  'image-convert',
  'image-base64',
  'countdown',
  'stopwatch',
  'text-sort',
  'lorem-ipsum',
  'hmac',
  'bcrypt',
  'barcode-generate',
  'color-picker-image',
  'user-agent',
  'ip-subnet',
]

function rank(id: string): number {
  const i = POPULARITY.indexOf(id)
  return i === -1 ? POPULARITY.length : i
}

tools.sort((a, b) => {
  const ra = rank(a.id)
  const rb = rank(b.id)
  if (ra !== rb) return ra - rb
  return a.title['zh-TW'].localeCompare(b.title['zh-TW'])
})

export const allTools: RegisteredTool[] = tools

export const toolsByRoute: Record<string, RegisteredTool> = Object.fromEntries(
  tools.map((t) => [t.route, t]),
)

/** Per-tool messages, namespaced under tools.<id>, for merging into vue-i18n. */
export function collectToolMessages(): Record<string, Record<string, unknown>> {
  const merged: Record<string, Record<string, unknown>> = {}
  for (const mod of Object.values(metaModules)) {
    if (!mod.messages || !mod.meta) continue
    const id = mod.meta.id
    for (const [locale, dict] of Object.entries(mod.messages)) {
      merged[locale] ??= { tools: {} }
      ;(merged[locale].tools as Record<string, unknown>)[id] = dict
    }
  }
  return merged
}

export const categoryLabels: Record<CategoryId, LocalizedText> = {
  encode: { 'zh-TW': '編碼 / 加密', en: 'Encode / Crypto', ja: 'エンコード / 暗号', ko: '인코딩 / 암호' },
  text: { 'zh-TW': '文字處理', en: 'Text', ja: 'テキスト', ko: '텍스트' },
  data: { 'zh-TW': '資料格式', en: 'Data Formats', ja: 'データ形式', ko: '데이터 형식' },
  convert: { 'zh-TW': '轉換 / 計算', en: 'Convert / Calc', ja: '変換 / 計算', ko: '변환 / 계산' },
  datetime: { 'zh-TW': '日期 / 時間', en: 'Date / Time', ja: '日付 / 時刻', ko: '날짜 / 시간' },
  generate: { 'zh-TW': '產生器', en: 'Generators', ja: 'ジェネレーター', ko: '생성기' },
  media: { 'zh-TW': '圖片 / 多媒體', en: 'Media', ja: '画像 / メディア', ko: '이미지 / 미디어' },
  dev: { 'zh-TW': '網路 / 開發', en: 'Network / Dev', ja: 'ネットワーク / 開発', ko: '네트워크 / 개발' },
}
