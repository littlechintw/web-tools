import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildPages, buildSitemap, escapeHtml, fileForPath, renderPage, type SeoPage } from '@/lib/seo'

const template = readFileSync('index.html', 'utf8')
const opts = { siteName: '工具箱' }
const page: SeoPage = { path: '/base64', title: 'Base64 編解碼 · 工具箱', description: '編碼與解碼 "Base64" <fast> & more', schema: 'WebApplication' }

describe('renderPage()', () => {
  const out = renderPage(template, page, opts)
  it('replaces title and description exactly once and escapes them', () => {
    expect(out.match(/<title>/g)).toHaveLength(1)
    expect(out).toContain('<title>Base64 編解碼 · 工具箱</title>')
    expect(out.match(/<meta name="description"/g)).toHaveLength(1)
    expect(out).toContain('content="編碼與解碼 &quot;Base64&quot; &lt;fast&gt; &amp; more"')
    expect(out).not.toContain('<fast>')
  })
  it('adds an absolute canonical and Open Graph tags', () => {
    expect(out).toContain('<link rel="canonical" href="https://tools.littlechin.tw/base64" />')
    expect(out).toContain('property="og:url" content="https://tools.littlechin.tw/base64"')
    expect(out).toContain('property="og:title"')
  })
  it('emits valid WebApplication JSON-LD', () => {
    const m = out.match(/<script type="application\/ld\+json">(.*)<\/script>/)!
    const j = JSON.parse(m[1])
    expect(j['@type']).toBe('WebApplication')
    expect(j.url).toBe('https://tools.littlechin.tw/base64')
    expect(j.offers.price).toBe('0')
  })
  it('keeps the app shell intact', () => {
    expect(out).toContain('<div id="app"></div>')
    expect(out).toContain('type="module"')
  })
  it('noindex pages get robots noindex and no canonical', () => {
    const n = renderPage(template, { ...page, path: '/settings', noindex: true, schema: 'none' }, opts)
    expect(n).toContain('content="noindex,follow"')
    expect(n).not.toContain('rel="canonical"')
    expect(n).not.toContain('application/ld+json')
  })
  it('adds the AdSense account meta only when given', () => {
    expect(renderPage(template, page, opts)).not.toContain('google-adsense-account')
    expect(renderPage(template, page, { ...opts, adsenseAccount: 'ca-pub-1' })).toContain('<meta name="google-adsense-account" content="ca-pub-1" />')
  })
  it('fails loudly if the template loses an anchor', () => {
    expect(() => renderPage('<html><head></head></html>', page, opts)).toThrow(/missing/)
  })
  it("a title with $& or $1 is inserted literally", () => {
    expect(renderPage(template, { ...page, title: 'Cost $& $1' }, opts)).toContain('<title>Cost $&amp; $1</title>')
  })
})

describe('sitemap & paths', () => {
  it('lists absolute URLs and escapes ampersands', () => {
    const x = buildSitemap(['/', '/a&b'])
    expect(x).toContain('<loc>https://tools.littlechin.tw/</loc>')
    expect(x).toContain('<loc>https://tools.littlechin.tw/a&amp;b</loc>')
  })
  it('maps clean URLs to the file GitHub Pages serves', () => {
    expect(fileForPath('/')).toBe('index.html')
    expect(fileForPath('/base64')).toBe('base64.html')
  })
  it('escapeHtml handles all five characters', () => expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;'))
})

describe('buildPages()', () => {
  const zh = { app: { name: '工具箱', tagline: '免費・純前端', privacy: 'p' }, nav: { history: '歷史', settings: '設定' }, tools: { a: { title: 'A', description: 'da' }, b: { title: 'B', description: 'db' } } }
  const pages = buildPages([{ id: 'a', route: 'a' }, { id: 'b', route: 'b-route' }], zh)
  it('has home, privacy, noindex user pages and every tool', () => {
    expect(pages.map((p) => p.path)).toEqual(['/', '/privacy', '/history', '/settings', '/a', '/b-route'])
    expect(pages.filter((p) => p.noindex).map((p) => p.path)).toEqual(['/history', '/settings'])
  })
  it('throws when a tool has no zh-TW text', () => {
    expect(() => buildPages([{ id: 'x', route: 'x' }], zh)).toThrow(/tools\.x/)
  })
})
