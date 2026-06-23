import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'base64',
  route: 'base64',
  category: 'encode',
  icon: 'mdi-code-braces',
  order: 1,
  title: { 'zh-TW': 'Base64 編解碼', en: 'Base64 Encode / Decode' },
  description: {
    'zh-TW': '文字與 Base64 互轉，支援 UTF-8 與 URL-safe 變體。',
    en: 'Convert text to/from Base64, with UTF-8 and URL-safe variants.',
  },
  keywords: ['base64', 'encode', 'decode', '編碼', '解碼', 'atob', 'btoa'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    encode: '編碼',
    decode: '解碼',
    urlSafe: 'URL-safe（- _ 取代 + /）',
    inputText: '輸入文字',
    inputBase64: '輸入 Base64',
    decodeError: '無法解碼：不是有效的 Base64 字串',
  },
  en: {
    encode: 'Encode',
    decode: 'Decode',
    urlSafe: 'URL-safe (- _ instead of + /)',
    inputText: 'Input text',
    inputBase64: 'Input Base64',
    decodeError: 'Cannot decode: not a valid Base64 string',
  },
}
