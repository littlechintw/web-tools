import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'uuid',
  route: 'uuid',
  category: 'encode',
  icon: 'mdi-identifier',
  title: { 'zh-TW': 'UUID / NanoID 產生器', en: 'UUID / NanoID Generator', ja: 'UUID / NanoID 生成', ko: 'UUID / NanoID 생성기' },
  description: {
    'zh-TW': '批次產生 UUID v4 與 NanoID，支援大小寫與移除連字號。',
    en: 'Bulk-generate UUID v4 and NanoID, with case and hyphen options.',
    ja: 'UUID v4 と NanoID をまとめて生成します。大文字・小文字やハイフン除去に対応。',
    ko: 'UUID v4 와 NanoID 를 일괄 생성하며 대소문자와 하이픈 제거를 지원합니다.',
  },
  keywords: ['uuid', 'nanoid', 'guid', 'id', 'random', '識別碼', '亂數', '識別子', '식별자'],
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
  ja: {
    uuidTab: 'UUID v4',
    nanoidTab: 'NanoID',
    count: '数量',
    uppercase: '大文字',
    removeHyphens: 'ハイフンを除去',
    nanoidSize: 'NanoID の長さ',
    regenerate: '再生成',
    copyAll: 'すべてコピー',
  },
  ko: {
    uuidTab: 'UUID v4',
    nanoidTab: 'NanoID',
    count: '수량',
    uppercase: '대문자',
    removeHyphens: '하이픈 제거',
    nanoidSize: 'NanoID 길이',
    regenerate: '다시 생성',
    copyAll: '모두 복사',
  },
}
