import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'image-convert',
  route: 'image-convert',
  category: 'media',
  icon: 'mdi-image-sync',
  title: { 'zh-TW': '圖片格式轉換 / 壓縮', en: 'Image Convert / Compress' },
  description: {
    'zh-TW': '在 PNG、JPEG、WEBP 之間轉換圖片，並可調整品質與壓縮大小。',
    en: 'Convert images between PNG, JPEG and WEBP, with quality and size compression.',
  },
  keywords: ['image', 'convert', 'compress', 'png', 'jpeg', 'webp', '圖片', '轉換', '壓縮'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    uploadHint: '上傳圖片（PNG / JPEG / WEBP …）',
    targetFormat: '目標格式',
    quality: '品質',
    compress: '額外壓縮（限制最大檔案大小）',
    maxSize: '最大檔案大小 (MB)',
    convert: '轉換',
    converting: '處理中…',
    original: '原始',
    result: '轉換結果',
    dimensions: '尺寸',
    fileSize: '檔案大小',
    download: '下載',
    errLoad: '無法載入圖片。',
    errConvert: '轉換失敗。',
  },
  en: {
    uploadHint: 'Upload an image (PNG / JPEG / WEBP …)',
    targetFormat: 'Target format',
    quality: 'Quality',
    compress: 'Extra compression (limit max file size)',
    maxSize: 'Max file size (MB)',
    convert: 'Convert',
    converting: 'Processing…',
    original: 'Original',
    result: 'Result',
    dimensions: 'Dimensions',
    fileSize: 'File size',
    download: 'Download',
    errLoad: 'Could not load the image.',
    errConvert: 'Conversion failed.',
  },
}
