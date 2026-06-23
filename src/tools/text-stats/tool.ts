import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'text-stats',
  route: 'text-stats',
  category: 'text',
  icon: 'mdi-counter',
  title: {
    'zh-TW': '字數 / 字元統計',
    en: 'Text / Character Stats',
    ja: '文字数 / 文字統計',
    ko: '글자 수 / 문자 통계',
  },
  description: {
    'zh-TW': '即時統計字元、字數、行數、位元組與閱讀時間。',
    en: 'Live counts of characters, words, lines, bytes and reading time.',
    ja: '文字数、単語数、行数、バイト数、読了時間をリアルタイムで集計します。',
    ko: '문자 수, 단어 수, 줄 수, 바이트 수, 읽기 시간을 실시간으로 집계합니다.',
  },
  keywords: ['count', 'words', 'characters', 'stats', '字數', '統計', '字元', '文字数カウント', '글자 수'],
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
  ja: {
    inputText: 'テキストを入力',
    chars: '文字数',
    charsNoSpaces: '文字数（空白を除く）',
    words: '単語数',
    lines: '行数',
    paragraphs: '段落数',
    bytes: 'UTF-8 バイト数',
    readingTime: '読了時間',
    minutes: '{n} 分',
  },
  ko: {
    inputText: '텍스트 입력',
    chars: '문자 수',
    charsNoSpaces: '문자 수（공백 제외）',
    words: '단어 수',
    lines: '줄 수',
    paragraphs: '단락 수',
    bytes: 'UTF-8 바이트',
    readingTime: '읽기 시간',
    minutes: '{n} 분',
  },
}
