import { useI18n } from 'vue-i18n'
import type { Locale, LocalizedText } from '@/types'

/** Returns a function that picks the current-locale string from a LocalizedText. */
export function useLocalized() {
  const { locale } = useI18n()
  return (text: LocalizedText): string => {
    const l = locale.value as Locale
    return text[l] ?? text['zh-TW']
  }
}
