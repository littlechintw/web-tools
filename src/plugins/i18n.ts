import { createI18n } from 'vue-i18n'
import type { Locale } from '@/types'

const STORAGE_KEY = 'app.locale'

// Auto-discover every locale file in src/locales/. To add a language, drop in
// a `<code>.ts` here (copy an existing one and translate) — nothing else needs
// editing. Optionally add a display label to LOCALE_LABELS below.
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>('@/locales/*.ts', {
  eager: true,
})

const messages: Record<string, Record<string, unknown>> = {}
for (const [path, mod] of Object.entries(localeModules)) {
  const code = path.split('/').pop()!.replace(/\.ts$/, '')
  messages[code] = mod.default
}

const LOCALE_LABELS: Record<string, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
}

export const SUPPORTED_LOCALES: { value: Locale; label: string }[] = Object.keys(messages)
  .sort((a, b) => (a === 'zh-TW' ? -1 : b === 'zh-TW' ? 1 : a.localeCompare(b)))
  .map((code) => ({ value: code as Locale, label: LOCALE_LABELS[code] ?? code }))

function detectLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && messages[saved]) return saved as Locale
  const nav = navigator.language.toLowerCase()
  if (nav.startsWith('ja')) return 'ja'
  if (nav.startsWith('ko')) return 'ko'
  if (nav.startsWith('en')) return 'en'
  return 'zh-TW'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  // Any locale falls back to English, then Traditional Chinese, for missing keys.
  fallbackLocale: { en: ['zh-TW'], default: ['en', 'zh-TW'] },
  messages: messages as never,
  missingWarn: false,
  fallbackWarn: false,
})

type LocaleRef = { value: Locale }

export function setLocale(locale: Locale) {
  ;(i18n.global.locale as unknown as LocaleRef).value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale === 'zh-TW' ? 'zh-Hant' : locale
}

export function currentLocale(): Locale {
  return (i18n.global.locale as unknown as LocaleRef).value
}
