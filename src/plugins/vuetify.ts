import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

const STORAGE_KEY = 'app.theme'

function initialTheme(): 'light' | 'dark' {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    // storage access can throw (blocked cookies, some embedded contexts)
  }
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const vuetify = createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: initialTheme(),
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

export function persistTheme(theme: string) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // best-effort persistence
  }
}
