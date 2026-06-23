import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'base64',
  route: 'base64',
  category: 'encode',
  icon: 'mdi-code-braces',
  order: 1,
  title: {
    'zh-TW': 'Base64 編解碼',
    en: 'Base64 Encode / Decode',
    ja: 'Base64 エンコード / デコード',
    ko: 'Base64 인코드 / 디코드',
  },
  description: {
    'zh-TW': '文字與 Base64 互轉，支援 UTF-8 與 URL-safe 變體。',
    en: 'Convert text to/from Base64, with UTF-8 and URL-safe variants.',
    ja: 'テキストと Base64 を相互変換します。UTF-8 と URL-safe 形式に対応。',
    ko: '텍스트와 Base64 를 상호 변환하며 UTF-8 및 URL-safe 형식을 지원합니다.',
  },
  keywords: ['base64', 'encode', 'decode', '編碼', '解碼', 'atob', 'btoa', 'エンコード', '인코딩'],
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
  ja: {
    encode: 'エンコード',
    decode: 'デコード',
    urlSafe: 'URL-safe（+ / の代わりに - _）',
    inputText: 'テキストを入力',
    inputBase64: 'Base64 を入力',
    decodeError: 'デコードできません：有効な Base64 文字列ではありません',
  },
  ko: {
    encode: '인코드',
    decode: '디코드',
    urlSafe: 'URL-safe（+ / 대신 - _）',
    inputText: '텍스트 입력',
    inputBase64: 'Base64 입력',
    decodeError: '디코드할 수 없습니다: 유효한 Base64 문자열이 아닙니다',
  },
}
