import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'bcrypt',
  route: 'bcrypt',
  category: 'encode',
  icon: 'mdi-lock',
  title: { 'zh-TW': 'Bcrypt 雜湊 / 驗證', en: 'Bcrypt Hash / Verify' },
  description: {
    'zh-TW': '產生 bcrypt 雜湊或驗證明文與雜湊是否相符，全程在瀏覽器執行。',
    en: 'Generate a bcrypt hash or verify a plaintext against a hash, entirely in the browser.',
  },
  keywords: ['bcrypt', 'hash', 'password', 'verify', '雜湊', '密碼', '驗證'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    hashTab: '產生雜湊',
    verifyTab: '驗證',
    inputText: '輸入文字',
    rounds: '成本 (rounds)',
    hashResult: 'Bcrypt 雜湊',
    generate: '產生',
    plaintext: '明文',
    hashToVerify: 'Bcrypt 雜湊',
    verify: '驗證',
    match: '相符',
    noMatch: '不相符',
    computing: '計算中…',
  },
  en: {
    hashTab: 'Hash',
    verifyTab: 'Verify',
    inputText: 'Input text',
    rounds: 'Cost (rounds)',
    hashResult: 'Bcrypt hash',
    generate: 'Generate',
    plaintext: 'Plaintext',
    hashToVerify: 'Bcrypt hash',
    verify: 'Verify',
    match: 'Match',
    noMatch: 'No match',
    computing: 'Computing…',
  },
}
