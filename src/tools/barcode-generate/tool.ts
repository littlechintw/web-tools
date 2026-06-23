import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'barcode-generate',
  route: 'barcode-generate',
  category: 'generate',
  icon: 'mdi-barcode',
  order: 2,
  title: { 'zh-TW': '條碼產生器', en: 'Barcode Generator' },
  description: {
    'zh-TW': '支援 CODE128、CODE39、EAN、UPC、ITF14、MSI、Pharmacode 等格式，可調整尺寸並下載。',
    en: 'Generate barcodes in CODE128, CODE39, EAN, UPC, ITF14, MSI, Pharmacode and more. Adjust size and download.',
  },
  keywords: ['barcode', 'code128', 'ean', 'upc', '條碼', 'jsbarcode', 'generate'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    format: '條碼格式',
    value: '數值 / 內容',
    options: '選項',
    barWidth: '線條寬度',
    height: '高度',
    displayValue: '顯示文字',
    invalidValue: '此格式的數值無效',
    downloadPng: '下載 PNG',
    valueHint: '輸入要編碼的內容',
  },
  en: {
    format: 'Barcode format',
    value: 'Value / content',
    options: 'Options',
    barWidth: 'Bar width',
    height: 'Height',
    displayValue: 'Show text',
    invalidValue: 'Value is invalid for this format',
    downloadPng: 'Download PNG',
    valueHint: 'Enter content to encode',
  },
}
