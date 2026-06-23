import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'color-convert',
  route: 'color-convert',
  category: 'convert',
  icon: 'mdi-palette',
  title: { 'zh-TW': '顏色轉換器', en: 'Color Converter' },
  description: {
    'zh-TW': '解析 HEX / RGB / HSL 並互轉，預覽色塊與漸層色階。',
    en: 'Parse and convert between HEX / RGB / HSL with swatch and tints/shades.',
  },
  keywords: ['color', 'hex', 'rgb', 'hsl', '顏色', '色彩', 'palette', 'swatch'],
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
}
