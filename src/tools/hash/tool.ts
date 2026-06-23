import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'hash',
  route: 'hash',
  category: 'encode',
  icon: 'mdi-pound',
  title: { 'zh-TW': '雜湊產生器', en: 'Hash Generator' },
  description: {
    'zh-TW': '計算文字或檔案的 MD5、SHA-1、SHA-256、SHA-384、SHA-512 雜湊值。',
    en: 'Compute MD5, SHA-1, SHA-256, SHA-384 and SHA-512 hashes of text or a file.',
  },
  keywords: ['hash', 'md5', 'sha', 'sha256', 'sha512', 'checksum', '雜湊', '校驗碼'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    text: '文字',
    file: '檔案',
    inputText: '輸入文字',
    uppercase: '大寫輸出',
    selectedFile: '已選檔案',
    computing: '計算中…',
  },
  en: {
    text: 'Text',
    file: 'File',
    inputText: 'Input text',
    uppercase: 'Uppercase output',
    selectedFile: 'Selected file',
    computing: 'Computing…',
  },
}
