import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'json-convert',
  route: 'json-convert',
  category: 'data',
  icon: 'mdi-swap-horizontal',
  title: {
    'zh-TW': 'JSON / YAML / TOML / CSV 互轉',
    en: 'JSON / YAML / TOML / CSV Convert',
    ja: 'JSON / YAML / TOML / CSV 相互変換',
    ko: 'JSON / YAML / TOML / CSV 변환',
  },
  description: {
    'zh-TW': '在 JSON、YAML、TOML、CSV 之間互相轉換結構化資料。',
    en: 'Convert structured data between JSON, YAML, TOML and CSV.',
    ja: 'JSON・YAML・TOML・CSV の間で構造化データを相互変換します。',
    ko: 'JSON, YAML, TOML, CSV 간에 구조화된 데이터를 상호 변환합니다.',
  },
  keywords: ['json', 'yaml', 'toml', 'csv', 'convert', '轉換', '互轉', '格式', '変換', '相互変換', '변환', '형식'],
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
  ja: {
    sourceFormat: '変換元フォーマット',
    targetFormat: '変換先フォーマット',
    inputData: '入力データ',
    parseError: '解析に失敗しました',
    convertError: '変換に失敗しました',
    csvNote: 'CSV にはオブジェクトの配列（ヘッダー行を含む）が必要です。',
  },
  ko: {
    sourceFormat: '원본 형식',
    targetFormat: '대상 형식',
    inputData: '입력 데이터',
    parseError: '파싱 실패',
    convertError: '변환 실패',
    csvNote: 'CSV는 객체 배열(헤더 행 포함)이 필요합니다.',
  },
}
