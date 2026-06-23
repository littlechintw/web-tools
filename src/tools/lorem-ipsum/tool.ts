import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'lorem-ipsum',
  route: 'lorem-ipsum',
  category: 'text',
  icon: 'mdi-text-long',
  title: { 'zh-TW': '假文產生器 (Lorem Ipsum)', en: 'Lorem Ipsum Generator' },
  description: {
    'zh-TW': '產生指定數量的段落、句子或字詞假文。',
    en: 'Generate placeholder paragraphs, sentences or words.',
  },
  keywords: ['lorem', 'ipsum', 'placeholder', 'dummy', '假文', '佔位'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    mode: '模式',
    paragraphs: '段落',
    sentences: '句子',
    words: '字詞',
    count: '數量',
    startClassic: '以「Lorem ipsum dolor sit amet」開頭',
    generate: '產生',
  },
  en: {
    mode: 'Mode',
    paragraphs: 'Paragraphs',
    sentences: 'Sentences',
    words: 'Words',
    count: 'Count',
    startClassic: 'Start with "Lorem ipsum dolor sit amet"',
    generate: 'Generate',
  },
}
