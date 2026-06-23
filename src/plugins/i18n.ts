import { createI18n } from 'vue-i18n'
import type { Locale } from '@/types'
import { collectToolMessages } from '@/tools/registry'
import zhTW from '@/locales/zh-TW'
import en from '@/locales/en'

const STORAGE_KEY = 'app.locale'

export const SUPPORTED_LOCALES: { value: Locale; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
]

function detectLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'zh-TW' || saved === 'en') return saved
  const nav = navigator.language.toLowerCase()
  if (nav.startsWith('en')) return 'en'
  return 'zh-TW'
}

// Deep-merge tool messages on top of the shell messages.
function mergeMessages() {
  const base: Record<string, Record<string, unknown>> = {
    'zh-TW': { ...zhTW },
    en: { ...en },
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
  fallbackLocale: 'zh-TW',
  // Messages are dynamically merged from tool modules; loosen the type here.
  messages: mergeMessages() as never,
  missingWarn: false,
  fallbackWarn: false,
})

type LocaleRef = { value: Locale }

export function setLocale(locale: Locale) {
  ;(i18n.global.locale as unknown as LocaleRef).value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale === 'zh-TW' ? 'zh-Hant' : 'en'
}

export function currentLocale(): Locale {
  return (i18n.global.locale as unknown as LocaleRef).value
}
