import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'image-base64',
  route: 'image-base64',
  category: 'media',
  icon: 'mdi-image-text',
  title: { 'zh-TW': '圖片 ↔ Base64', en: 'Image ↔ Base64' },
  description: {
    'zh-TW': '把圖片轉成 Base64 Data URI，或把 Data URI 還原成圖片預覽。',
    en: 'Turn an image into a Base64 data URI, or render a data URI back into an image.',
  },
  keywords: ['image', 'base64', 'data uri', 'datauri', '圖片', '編碼'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    toBase64: '圖片轉 Base64',
    toImage: 'Base64 轉圖片',
    uploadHint: '上傳圖片',
    dataUri: 'Data URI',
    byteSize: '位元組大小',
    cssSnippet: 'CSS background',
    imgSnippet: '<img> 標籤',
    pasteHint: '貼上 data URI（data:image/...;base64,...）',
    preview: '預覽',
    download: '下載',
    errInvalid: '不是有效的圖片 Data URI。',
  },
  en: {
    toBase64: 'Image to Base64',
    toImage: 'Base64 to Image',
    uploadHint: 'Upload an image',
    dataUri: 'Data URI',
    byteSize: 'Byte size',
    cssSnippet: 'CSS background',
    imgSnippet: '<img> tag',
    pasteHint: 'Paste a data URI (data:image/...;base64,...)',
    preview: 'Preview',
    download: 'Download',
    errInvalid: 'Not a valid image data URI.',
  },
}
