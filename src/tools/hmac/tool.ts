import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'hmac',
  route: 'hmac',
  category: 'encode',
  icon: 'mdi-key',
  title: { 'zh-TW': 'HMAC 產生器', en: 'HMAC Generator', ja: 'HMAC 生成', ko: 'HMAC 생성기' },
  description: {
    'zh-TW': '使用密鑰計算 HMAC（SHA-1/256/384/512），輸出十六進位與 Base64。',
    en: 'Compute HMAC (SHA-1/256/384/512) with a secret key, output as hex and Base64.',
    ja: '秘密鍵を使って HMAC（SHA-1/256/384/512）を計算し、16 進数と Base64 で出力します。',
    ko: '비밀 키로 HMAC(SHA-1/256/384/512)를 계산하여 16진수와 Base64로 출력합니다.',
  },
  keywords: ['hmac', 'mac', 'sha', 'signature', '簽章', '密鑰', 'secret', '署名', '서명'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    message: '訊息',
    secret: '密鑰 (Secret)',
    algorithm: '演算法',
    hex: '十六進位 (Hex)',
    base64: 'Base64',
    computing: '計算中…',
  },
  en: {
    message: 'Message',
    secret: 'Secret key',
    algorithm: 'Algorithm',
    hex: 'Hex',
    base64: 'Base64',
    computing: 'Computing…',
  },
  ja: {
    message: 'メッセージ',
    secret: '秘密鍵 (Secret)',
    algorithm: 'アルゴリズム',
    hex: '16 進数 (Hex)',
    base64: 'Base64',
    computing: '計算中…',
  },
  ko: {
    message: '메시지',
    secret: '비밀 키 (Secret)',
    algorithm: '알고리즘',
    hex: '16진수 (Hex)',
    base64: 'Base64',
    computing: '계산 중…',
  },
}
