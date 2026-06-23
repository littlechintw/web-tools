import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'case-convert',
  route: 'case-convert',
  category: 'text',
  icon: 'mdi-format-letter-case',
  title: { 'zh-TW': '大小寫 / 命名轉換', en: 'Case / Naming Convert' },
  description: {
    'zh-TW': '一次轉換成多種命名與大小寫格式。',
    en: 'Convert text into many naming and case styles at once.',
  },
  keywords: ['case', 'camel', 'snake', 'kebab', 'pascal', '命名', '大小寫', '駝峰'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    inputText: '輸入文字',
  },
  en: {
    inputText: 'Input text',
  },
}
