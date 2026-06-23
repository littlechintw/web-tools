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

// Stable sort: by category order, then explicit order, then title.
const categoryOrder: CategoryId[] = [
  'encode',
  'text',
  'data',
  'convert',
  'datetime',
  'generate',
  'media',
  'dev',
]

tools.sort((a, b) => {
  const ca = categoryOrder.indexOf(a.category)
  const cb = categoryOrder.indexOf(b.category)
  if (ca !== cb) return ca - cb
  const oa = a.order ?? 100
  const ob = b.order ?? 100
  if (oa !== ob) return oa - ob
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
  encode: { 'zh-TW': '編碼 / 加密', en: 'Encode / Crypto' },
  text: { 'zh-TW': '文字處理', en: 'Text' },
  data: { 'zh-TW': '資料格式', en: 'Data Formats' },
  convert: { 'zh-TW': '轉換 / 計算', en: 'Convert / Calc' },
  datetime: { 'zh-TW': '日期 / 時間', en: 'Date / Time' },
  generate: { 'zh-TW': '產生器', en: 'Generators' },
  media: { 'zh-TW': '圖片 / 多媒體', en: 'Media' },
  dev: { 'zh-TW': '網路 / 開發', en: 'Network / Dev' },
}
