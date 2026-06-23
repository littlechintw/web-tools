import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'text-diff',
  route: 'text-diff',
  category: 'text',
  icon: 'mdi-file-compare',
  title: { 'zh-TW': '文字比對 (Diff)', en: 'Text Diff' },
  description: {
    'zh-TW': '比對兩段文字，逐行或逐字顯示差異。',
    en: 'Compare two texts and highlight line or word differences.',
  },
  keywords: ['diff', 'compare', 'text', '比對', '差異', '對比'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    original: '原始文字',
    changed: '變更後文字',
    lineMode: '逐行比對',
    wordMode: '逐字比對',
    additions: '新增 {n}',
    deletions: '刪除 {n}',
    noDiff: '兩段文字相同。',
  },
  en: {
    original: 'Original',
    changed: 'Changed',
    lineMode: 'Line diff',
    wordMode: 'Word diff',
    additions: '{n} added',
    deletions: '{n} removed',
    noDiff: 'The two texts are identical.',
  },
}
