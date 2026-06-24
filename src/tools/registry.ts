import type { CategoryId, RegisteredTool, ToolMeta } from '@/types'

// Eagerly load every tool's metadata. Each tool folder must contain a
// `tool.ts` exporting `meta`. Translatable text lives in src/locales/, not here.
const metaModules = import.meta.glob<{ meta: ToolMeta }>('./*/tool.ts', { eager: true })

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
  'image-editor',
  'image-convert',
  'pdf-merge',
  'pdf-split',
  'image-to-pdf',
  'pdf-to-image',
  'pdf-sign',
  'pdf-organize',
  'pdf-watermark',
  'image-base64',
  'image-editor-pro',
  'image-strip-exif',
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
  'wooden-fish',
  'bubble-wrap',
  'jiaobei',
  'joss-paper',
  'satisfying-switch',
  'lottery',
  'spin-wheel',
]

function rank(id: string): number {
  const i = POPULARITY.indexOf(id)
  return i === -1 ? POPULARITY.length : i
}

tools.sort((a, b) => {
  const ra = rank(a.id)
  const rb = rank(b.id)
  if (ra !== rb) return ra - rb
  return a.id.localeCompare(b.id)
})

export const allTools: RegisteredTool[] = tools

export const toolsByRoute: Record<string, RegisteredTool> = Object.fromEntries(
  tools.map((t) => [t.route, t]),
)

/** Category display order for the home filter chips and the sidebar groups.
 *  Labels come from i18n: t('categories.<id>'). */
export const categoryOrder: CategoryId[] = [
  'encode',
  'text',
  'data',
  'convert',
  'datetime',
  'generate',
  'media',
  'pdf',
  'dev',
  'fun',
]
