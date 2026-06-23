import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'barcode-generate',
  route: 'barcode-generate',
  category: 'generate',
  icon: 'mdi-barcode',
  order: 2,
  title: {
    'zh-TW': '條碼產生器',
    en: 'Barcode Generator',
    ja: 'バーコード生成',
    ko: '바코드 생성',
  },
  description: {
    'zh-TW': '支援 CODE128、CODE39、EAN、UPC、ITF14、MSI、Pharmacode 等格式，可調整尺寸並下載。',
    en: 'Generate barcodes in CODE128, CODE39, EAN, UPC, ITF14, MSI, Pharmacode and more. Adjust size and download.',
    ja: 'CODE128、CODE39、EAN、UPC、ITF14、MSI、Pharmacode などの形式に対応。サイズを調整してダウンロードできます。',
    ko: 'CODE128, CODE39, EAN, UPC, ITF14, MSI, Pharmacode 등의 형식을 지원하며 크기를 조정해 다운로드할 수 있습니다.',
  },
  keywords: ['barcode', 'code128', 'ean', 'upc', '條碼', 'jsbarcode', 'generate', 'バーコード生成', '바코드 생성'],
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
  ja: {
    format: 'バーコード形式',
    value: '数値 / 内容',
    options: 'オプション',
    barWidth: 'バーの幅',
    height: '高さ',
    displayValue: 'テキストを表示',
    invalidValue: 'この形式では数値が無効です',
    downloadPng: 'PNG をダウンロード',
    valueHint: 'エンコードする内容を入力してください',
  },
  ko: {
    format: '바코드 형식',
    value: '값 / 내용',
    options: '옵션',
    barWidth: '바 너비',
    height: '높이',
    displayValue: '텍스트 표시',
    invalidValue: '이 형식에는 값이 유효하지 않습니다',
    downloadPng: 'PNG 다운로드',
    valueHint: '인코딩할 내용을 입력하세요',
  },
}
