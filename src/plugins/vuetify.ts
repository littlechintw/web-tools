import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { ref } from 'vue'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'app.theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function storedMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // storage access can throw (blocked cookies, some embedded contexts)
  }
  return 'system'
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (media.matches ? 'dark' : 'light') : mode
}

/** The user's choice: an explicit theme, or "follow the OS". */
export const themeMode = ref<ThemeMode>(storedMode())

export const vuetify = createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: resolve(themeMode.value),
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#1867C0',
          secondary: '#5CBBF6',
          surface: '#FFFFFF',
          background: '#F5F7FA',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#5CBBF6',
          secondary: '#1867C0',
          surface: '#1E1E24',
          background: '#121216',
        },
      },
    },
  },
  defaults: {
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VTextarea: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
    VCard: { rounded: 'lg' },
    VBtn: { variant: 'flat' },
  },
})

export function setThemeMode(mode: ThemeMode) {
  themeMode.value = mode
  try {
    if (mode === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // best-effort persistence
  }
  vuetify.theme.change(resolve(mode))
}

// Follow OS changes live while in "system" mode.
media.addEventListener('change', () => {
  if (themeMode.value === 'system') vuetify.theme.change(resolve('system'))
})
