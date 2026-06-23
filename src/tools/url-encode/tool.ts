import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'url-encode',
  route: 'url-encode',
  category: 'encode',
  icon: 'mdi-link-variant',
  title: {
    'zh-TW': 'URL 編解碼',
    en: 'URL Encode / Decode',
    ja: 'URL エンコード / デコード',
    ko: 'URL 인코드 / 디코드',
  },
  description: {
    'zh-TW': 'URL 編碼與解碼，支援元件 (encodeURIComponent) 與完整 URI 兩種模式。',
    en: 'Encode and decode URLs, with component (encodeURIComponent) and full URI modes.',
    ja: 'URL のエンコードとデコード。コンポーネント (encodeURIComponent) と完全 URI の 2 つのモードに対応。',
    ko: 'URL 인코딩과 디코딩. 컴포넌트 (encodeURIComponent) 와 전체 URI 두 가지 모드를 지원합니다.',
  },
  keywords: ['url', 'encode', 'decode', 'uri', 'percent', '編碼', '解碼', '網址', 'エンコード', '인코딩'],
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
  ja: {
    encode: 'エンコード',
    decode: 'デコード',
    component: 'コンポーネント (encodeURIComponent)',
    full: '完全 URI (encodeURI)',
    mode: 'モード',
    scope: '範囲',
    inputText: 'テキストを入力',
    inputEncoded: 'エンコード済み文字列を入力',
    decodeError: 'デコードできません：無効なパーセントエンコードシーケンスが含まれています',
  },
  ko: {
    encode: '인코드',
    decode: '디코드',
    component: '컴포넌트 (encodeURIComponent)',
    full: '전체 URI (encodeURI)',
    mode: '모드',
    scope: '범위',
    inputText: '텍스트 입력',
    inputEncoded: '인코딩된 문자열 입력',
    decodeError: '디코드할 수 없습니다: 잘못된 퍼센트 인코딩 시퀀스가 포함되어 있습니다',
  },
}
