import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'lorem-ipsum',
  route: 'lorem-ipsum',
  category: 'text',
  icon: 'mdi-text-long',
  title: {
    'zh-TW': '假文產生器 (Lorem Ipsum)',
    en: 'Lorem Ipsum Generator',
    ja: 'ダミーテキスト生成 (Lorem Ipsum)',
    ko: '더미 텍스트 생성기 (Lorem Ipsum)',
  },
  description: {
    'zh-TW': '產生指定數量的段落、句子或字詞假文。',
    en: 'Generate placeholder paragraphs, sentences or words.',
    ja: '指定した数の段落、文、または単語のダミーテキストを生成します。',
    ko: '지정한 개수의 단락, 문장 또는 단어 더미 텍스트를 생성합니다.',
  },
  keywords: ['lorem', 'ipsum', 'placeholder', 'dummy', '假文', '佔位', 'ダミーテキスト', '더미 텍스트'],
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
  ja: {
    mode: 'モード',
    paragraphs: '段落',
    sentences: '文',
    words: '単語',
    count: '数量',
    startClassic: '「Lorem ipsum dolor sit amet」で開始',
    generate: '生成',
  },
  ko: {
    mode: '모드',
    paragraphs: '단락',
    sentences: '문장',
    words: '단어',
    count: '개수',
    startClassic: '「Lorem ipsum dolor sit amet」로 시작',
    generate: '생성',
  },
}
