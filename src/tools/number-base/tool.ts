import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'number-base',
  route: 'number-base',
  category: 'convert',
  icon: 'mdi-numeric',
  title: {
    'zh-TW': '進制轉換',
    en: 'Number Base Converter',
    ja: '基数変換',
    ko: '진법 변환',
  },
  description: {
    'zh-TW': '在二進位、八進位、十進位、十六進位與任意 2-36 進制間轉換整數。',
    en: 'Convert integers between binary, octal, decimal, hex and any base 2-36.',
    ja: '2進数・8進数・10進数・16進数、および任意の 2〜36 進数の間で整数を変換します。',
    ko: '2진수, 8진수, 10진수, 16진수 및 임의의 2~36진법 사이에서 정수를 변환합니다.',
  },
  keywords: ['base', 'radix', 'binary', 'hex', 'octal', '進制', '二進位', '十六進位', 'bigint', '基数', '進数', '진법', '진수'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    value: '數值',
    sourceBase: '來源進制',
    customBase: '自訂進制',
    binary: '二進位 (2)',
    octal: '八進位 (8)',
    decimal: '十進位 (10)',
    hex: '十六進位 (16)',
    custom: '自訂',
    invalid: '含有無效的數字（不符合來源進制）',
    base: '進制',
  },
  en: {
    value: 'Value',
    sourceBase: 'Source base',
    customBase: 'Custom base',
    binary: 'Binary (2)',
    octal: 'Octal (8)',
    decimal: 'Decimal (10)',
    hex: 'Hex (16)',
    custom: 'Custom',
    invalid: 'Contains invalid digits for the source base',
    base: 'Base',
  },
}
