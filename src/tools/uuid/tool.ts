import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'uuid',
  route: 'uuid',
  category: 'encode',
  icon: 'mdi-identifier',
  title: { 'zh-TW': 'UUID / NanoID 產生器', en: 'UUID / NanoID Generator' },
  description: {
    'zh-TW': '批次產生 UUID v4 與 NanoID，支援大小寫與移除連字號。',
    en: 'Bulk-generate UUID v4 and NanoID, with case and hyphen options.',
  },
  keywords: ['uuid', 'nanoid', 'guid', 'id', 'random', '識別碼', '亂數'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    uuidTab: 'UUID v4',
    nanoidTab: 'NanoID',
    count: '數量',
    uppercase: '大寫',
    removeHyphens: '移除連字號',
    nanoidSize: 'NanoID 長度',
    regenerate: '重新產生',
    copyAll: '全部複製',
  },
  en: {
    uuidTab: 'UUID v4',
    nanoidTab: 'NanoID',
    count: 'Count',
    uppercase: 'Uppercase',
    removeHyphens: 'Remove hyphens',
    nanoidSize: 'NanoID size',
    regenerate: 'Regenerate',
    copyAll: 'Copy all',
  },
}
