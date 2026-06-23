import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'json-convert',
  route: 'json-convert',
  category: 'data',
  icon: 'mdi-swap-horizontal',
  title: { 'zh-TW': 'JSON / YAML / TOML / CSV 互轉', en: 'JSON / YAML / TOML / CSV Convert' },
  description: {
    'zh-TW': '在 JSON、YAML、TOML、CSV 之間互相轉換結構化資料。',
    en: 'Convert structured data between JSON, YAML, TOML and CSV.',
  },
  keywords: ['json', 'yaml', 'toml', 'csv', 'convert', '轉換', '互轉', '格式'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    sourceFormat: '來源格式',
    targetFormat: '目標格式',
    inputData: '輸入資料',
    parseError: '解析失敗',
    convertError: '轉換失敗',
    csvNote: 'CSV 需要物件陣列（含表頭）。',
  },
  en: {
    sourceFormat: 'Source format',
    targetFormat: 'Target format',
    inputData: 'Input data',
    parseError: 'Parse error',
    convertError: 'Convert error',
    csvNote: 'CSV expects an array of objects (with a header row).',
  },
}
