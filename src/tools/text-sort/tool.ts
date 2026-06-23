import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'text-sort',
  route: 'text-sort',
  category: 'text',
  icon: 'mdi-sort',
  title: { 'zh-TW': '文字排序 / 去重', en: 'Text Sort / Dedupe' },
  description: {
    'zh-TW': '逐行排序、去除重複、反轉與整理文字。',
    en: 'Sort lines, remove duplicates, reverse and tidy text.',
  },
  keywords: ['sort', 'dedupe', 'unique', 'lines', '排序', '去重', '去除重複'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    inputText: '輸入文字（每行一項）',
    sort: '排序',
    none: '不排序',
    asc: '升冪',
    desc: '降冪',
    numeric: '數值排序',
    caseInsensitive: '忽略大小寫',
    removeDuplicates: '移除重複行',
    reverse: '反轉順序',
    trim: '修剪空白',
    removeEmpty: '移除空行',
    linesBefore: '處理前：{n} 行',
    linesAfter: '處理後：{n} 行',
  },
  en: {
    inputText: 'Input text (one item per line)',
    sort: 'Sort',
    none: 'No sort',
    asc: 'Ascending',
    desc: 'Descending',
    numeric: 'Numeric sort',
    caseInsensitive: 'Case-insensitive',
    removeDuplicates: 'Remove duplicates',
    reverse: 'Reverse order',
    trim: 'Trim whitespace',
    removeEmpty: 'Remove empty lines',
    linesBefore: 'Before: {n} lines',
    linesAfter: 'After: {n} lines',
  },
}
