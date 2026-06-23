import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'url-encode',
  route: 'url-encode',
  category: 'encode',
  icon: 'mdi-link-variant',
  title: { 'zh-TW': 'URL 編解碼', en: 'URL Encode / Decode' },
  description: {
    'zh-TW': 'URL 編碼與解碼，支援元件 (encodeURIComponent) 與完整 URI 兩種模式。',
    en: 'Encode and decode URLs, with component (encodeURIComponent) and full URI modes.',
  },
  keywords: ['url', 'encode', 'decode', 'uri', 'percent', '編碼', '解碼', '網址'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    encode: '編碼',
    decode: '解碼',
    component: '元件 (encodeURIComponent)',
    full: '完整 URI (encodeURI)',
    mode: '模式',
    scope: '範圍',
    inputText: '輸入文字',
    inputEncoded: '輸入編碼字串',
    decodeError: '無法解碼：包含無效的百分比編碼序列',
  },
  en: {
    encode: 'Encode',
    decode: 'Decode',
    component: 'Component (encodeURIComponent)',
    full: 'Full URI (encodeURI)',
    mode: 'Mode',
    scope: 'Scope',
    inputText: 'Input text',
    inputEncoded: 'Input encoded string',
    decodeError: 'Cannot decode: contains invalid percent-encoding sequences',
  },
}
