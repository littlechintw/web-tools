import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'text-stats',
  route: 'text-stats',
  category: 'text',
  icon: 'mdi-counter',
  title: { 'zh-TW': '字數 / 字元統計', en: 'Text / Character Stats' },
  description: {
    'zh-TW': '即時統計字元、字數、行數、位元組與閱讀時間。',
    en: 'Live counts of characters, words, lines, bytes and reading time.',
  },
  keywords: ['count', 'words', 'characters', 'stats', '字數', '統計', '字元'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    inputText: '輸入文字',
    chars: '字元數',
    charsNoSpaces: '字元數（不含空白）',
    words: '字數',
    lines: '行數',
    paragraphs: '段落數',
    bytes: 'UTF-8 位元組',
    readingTime: '閱讀時間',
    minutes: '{n} 分鐘',
  },
  en: {
    inputText: 'Input text',
    chars: 'Characters',
    charsNoSpaces: 'Characters (no spaces)',
    words: 'Words',
    lines: 'Lines',
    paragraphs: 'Paragraphs',
    bytes: 'UTF-8 bytes',
    readingTime: 'Reading time',
    minutes: '{n} min',
  },
}
