import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'color-convert',
  route: 'color-convert',
  category: 'convert',
  icon: 'mdi-palette',
  title: {
    'zh-TW': '顏色轉換器',
    en: 'Color Converter',
    ja: 'カラー変換',
    ko: '색상 변환',
  },
  description: {
    'zh-TW': '解析 HEX / RGB / HSL 並互轉，預覽色塊與漸層色階。',
    en: 'Parse and convert between HEX / RGB / HSL with swatch and tints/shades.',
    ja: 'HEX / RGB / HSL を解析して相互変換し、色見本と濃淡のグラデーションをプレビューします。',
    ko: 'HEX / RGB / HSL 을 분석하고 상호 변환하며 색상 견본과 명암 그러데이션을 미리 봅니다.',
  },
  keywords: ['color', 'hex', 'rgb', 'hsl', '顏色', '色彩', 'palette', 'swatch', 'カラー変換', '색상 변환'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    inputColor: '輸入顏色 (HEX / rgb() / hsl())',
    invalid: '無法解析顏色',
    picker: '色彩選擇器',
    preview: '預覽',
    tintsShades: '色階（亮 → 暗）',
    clickToCopy: '點擊複製',
  },
  en: {
    inputColor: 'Input color (HEX / rgb() / hsl())',
    invalid: 'Cannot parse color',
    picker: 'Color picker',
    preview: 'Preview',
    tintsShades: 'Tints & shades (light → dark)',
    clickToCopy: 'Click to copy',
  },
  ja: {
    inputColor: 'カラーを入力 (HEX / rgb() / hsl())',
    invalid: 'カラーを解析できません',
    picker: 'カラーピッカー',
    preview: 'プレビュー',
    tintsShades: '濃淡（明 → 暗）',
    clickToCopy: 'クリックしてコピー',
  },
  ko: {
    inputColor: '색상 입력 (HEX / rgb() / hsl())',
    invalid: '색상을 분석할 수 없습니다',
    picker: '색상 선택기',
    preview: '미리보기',
    tintsShades: '명암 단계（밝음 → 어두움）',
    clickToCopy: '클릭하여 복사',
  },
}
