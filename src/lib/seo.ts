/**
 * Build-time SEO helpers (pure, so they are unit-tested). vite.config.ts uses
 * them to write one static HTML file per route: GitHub Pages cannot do SPA
 * routing, so without this every deep link is served with HTTP 404 (the
 * 404.html fallback) and search engines will not index it.
 */
export const SITE_ORIGIN = 'https://tools.littlechin.tw'

export interface SeoPage {
  /** URL path, e.g. '/' or '/base64' */
  path: string
  title: string
  description: string
  noindex?: boolean
  /** schema.org type for the JSON-LD block */
  schema?: 'WebSite' | 'WebApplication' | 'none'
  appCategory?: string
}

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const absolute = (path: string, origin: string): string => origin + (path === '/' ? '/' : path)

/** Safe to embed inside <script type="application/ld+json">. */
const jsonLd = (o: unknown): string => JSON.stringify(o).replace(/</g, '\\u003c')

export function headBlock(page: SeoPage, opts: { origin?: string; siteName: string; adsenseAccount?: string }): string {
  const origin = opts.origin ?? SITE_ORIGIN
  const url = absolute(page.path, origin)
  const t = escapeHtml(page.title)
  const d = escapeHtml(page.description)
  const lines: string[] = []
  if (page.noindex) lines.push('<meta name="robots" content="noindex,follow" />')
  else {
    lines.push('<meta name="robots" content="index,follow,max-snippet:-1" />')
    lines.push(`<link rel="canonical" href="${escapeHtml(url)}" />`)
  }
  lines.push(
    `<meta property="og:site_name" content="${escapeHtml(opts.siteName)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:locale" content="zh_TW" />',
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
  )
  if (!page.noindex) lines.push(`<meta property="og:url" content="${escapeHtml(url)}" />`)
  lines.push('<meta name="twitter:card" content="summary" />', `<meta name="twitter:title" content="${t}" />`, `<meta name="twitter:description" content="${d}" />`)
  if (opts.adsenseAccount) lines.push(`<meta name="google-adsense-account" content="${escapeHtml(opts.adsenseAccount)}" />`)
  if (!page.noindex && page.schema === 'WebSite') {
    lines.push(`<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', name: opts.siteName, url: absolute('/', origin), inLanguage: 'zh-TW' })}</script>`)
  } else if (!page.noindex && page.schema === 'WebApplication') {
    lines.push(
      `<script type="application/ld+json">${jsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: page.title.split(' · ')[0],
        description: page.description,
        url,
        applicationCategory: page.appCategory ?? 'UtilitiesApplication',
        operatingSystem: 'Any',
        inLanguage: 'zh-TW',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
      })}</script>`,
    )
  }
  return lines.map((l) => '    ' + l).join('\n')
}

/** Rewrite the shell index.html for one route. Throws if the template lost an anchor we rely on. */
export function renderPage(template: string, page: SeoPage, opts: { origin?: string; siteName: string; adsenseAccount?: string }): string {
  const titleRe = /<title>[\s\S]*?<\/title>/
  const descRe = /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/
  if (!titleRe.test(template) || !descRe.test(template) || !template.includes('</head>')) {
    throw new Error('seo: index.html template is missing <title>, <meta name="description"> or </head>')
  }
  return template
    .replace(titleRe, () => `<title>${escapeHtml(page.title)}</title>`)
    .replace(descRe, () => `<meta name="description" content="${escapeHtml(page.description)}" />`)
    .replace('</head>', () => `${headBlock(page, opts)}\n  </head>`)
}

export function buildSitemap(paths: string[], origin = SITE_ORIGIN): string {
  const body = paths.map((p) => `  <url><loc>${escapeHtml(absolute(p, origin))}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

/** File name GitHub Pages serves at the clean URL: '/base64' -> 'base64.html'. */
export const fileForPath = (path: string): string => (path === '/' ? 'index.html' : `${path.replace(/^\//, '')}.html`)

type Tool = { id: string; route: string; category?: string }
type Dict = { app: { name: string; tagline: string; privacy: string }; nav: Record<string, string>; tools: Record<string, { title: string; description: string }>; privacyPage?: { title: string; intro: string } }

const CATEGORY: Record<string, string> = { dev: 'DeveloperApplication', media: 'MultimediaApplication', fun: 'GameApplication', datetime: 'UtilitiesApplication' }

export function buildPages(tools: Tool[], zh: Dict): SeoPage[] {
  const name = zh.app.name
  const pages: SeoPage[] = [
    {
      path: '/',
      title: `${name} · ${zh.app.tagline}`,
      description: `免費、注重隱私、純前端的線上工具包：${tools.length} 種工具涵蓋編解碼、文字、PDF、圖片、日期、計算與產生器。所有運算都在你的瀏覽器完成，資料不外傳。`,
      schema: 'WebSite',
    },
    { path: '/privacy', title: `${zh.privacyPage?.title ?? '隱私權政策'} · ${name}`, description: zh.privacyPage?.intro ?? zh.app.privacy, schema: 'none' },
    { path: '/history', title: `${zh.nav.history} · ${name}`, description: zh.app.privacy, noindex: true },
    { path: '/settings', title: `${zh.nav.settings} · ${name}`, description: zh.app.privacy, noindex: true },
  ]
  for (const t of tools) {
    const s = zh.tools[t.id]
    if (!s?.title || !s?.description) throw new Error(`seo: tools.${t.id} has no zh-TW title/description`)
    pages.push({ path: `/${t.route}`, title: `${s.title} · ${name}`, description: s.description, schema: 'WebApplication', appCategory: CATEGORY[t.category ?? ''] })
  }
  return pages
}
