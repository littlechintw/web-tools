import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'case-convert',
  route: 'case-convert',
  category: 'text',
  icon: 'mdi-format-letter-case',
  title: {
    'zh-TW': '大小寫 / 命名轉換',
    en: 'Case / Naming Convert',
    ja: '大文字小文字 / 命名規則変換',
    ko: '대소문자 / 명명 규칙 변환',
  },
  description: {
    'zh-TW': '一次轉換成多種命名與大小寫格式。',
    en: 'Convert text into many naming and case styles at once.',
    ja: 'テキストを複数の命名規則と大文字小文字の形式に一度に変換します。',
    ko: '텍스트를 여러 명명 규칙과 대소문자 형식으로 한 번에 변환합니다.',
  },
  keywords: ['case', 'camel', 'snake', 'kebab', 'pascal', '命名', '大小寫', '駝峰', '大文字小文字変換', '대소문자 변환'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    inputText: '輸入文字',
  },
  en: {
    inputText: 'Input text',
  },
  ja: {
    inputText: 'テキストを入力',
  },
  ko: {
    inputText: '텍스트 입력',
  },
}
