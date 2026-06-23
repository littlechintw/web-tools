import { createI18n } from 'vue-i18n'
import type { Locale } from '@/types'
import { collectToolMessages } from '@/tools/registry'
import zhTW from '@/locales/zh-TW'
import en from '@/locales/en'
import ja from '@/locales/ja'
import ko from '@/locales/ko'

const STORAGE_KEY = 'app.locale'

export const SUPPORTED_LOCALES: { value: Locale; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

const SUPPORTED = new Set<Locale>(['zh-TW', 'en', 'ja', 'ko'])

function detectLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && SUPPORTED.has(saved as Locale)) return saved as Locale
  const nav = navigator.language.toLowerCase()
  if (nav.startsWith('ja')) return 'ja'
  if (nav.startsWith('ko')) return 'ko'
  if (nav.startsWith('en')) return 'en'
  return 'zh-TW'
}

// Deep-merge tool messages on top of the shell messages.
function mergeMessages() {
  const base: Record<string, Record<string, unknown>> = {
    'zh-TW': { ...zhTW },
    en: { ...en },
    ja: { ...ja },
    ko: { ...ko },
  }
  const toolMsgs = collectToolMessages()
  for (const [locale, dict] of Object.entries(toolMsgs)) {
    base[locale] = { ...base[locale], ...dict }
  }
  return base
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  // Missing ja/ko strings fall back to English, then Traditional Chinese.
  fallbackLocale: {
    ja: ['en', 'zh-TW'],
    ko: ['en', 'zh-TW'],
    en: ['zh-TW'],
    default: ['zh-TW'],
  },
  // Messages are dynamically merged from tool modules; loosen the type here.
  messages: mergeMessages() as never,
  missingWarn: false,
  fallbackWarn: false,
})

type LocaleRef = { value: Locale }

export function setLocale(locale: Locale) {
  ;(i18n.global.locale as unknown as LocaleRef).value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  const htmlLang: Record<Locale, string> = { 'zh-TW': 'zh-Hant', en: 'en', ja: 'ja', ko: 'ko' }
  document.documentElement.lang = htmlLang[locale]
}

export function currentLocale(): Locale {
  return (i18n.global.locale as unknown as LocaleRef).value
}
