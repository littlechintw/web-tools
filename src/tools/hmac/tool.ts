import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'hmac',
  route: 'hmac',
  category: 'encode',
  icon: 'mdi-key',
  title: { 'zh-TW': 'HMAC 產生器', en: 'HMAC Generator' },
  description: {
    'zh-TW': '使用密鑰計算 HMAC（SHA-1/256/384/512），輸出十六進位與 Base64。',
    en: 'Compute HMAC (SHA-1/256/384/512) with a secret key, output as hex and Base64.',
  },
  keywords: ['hmac', 'mac', 'sha', 'signature', '簽章', '密鑰', 'secret'],
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
}
