import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'color-picker-image',
  route: 'color-picker-image',
  category: 'media',
  icon: 'mdi-eyedropper',
  title: { 'zh-TW': '圖片取色器', en: 'Image Color Picker' },
  description: {
    'zh-TW': '上傳圖片後在畫面上滑動取色，讀出 HEX 與 RGB，並保留取色紀錄。',
    en: 'Upload an image and hover/click to read the HEX & RGB of any pixel, with a picked-color history.',
  },
  keywords: ['color', 'picker', 'eyedropper', 'hex', 'rgb', '取色', '顏色'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    uploadHint: '上傳圖片以開始取色',
    hover: '游標顏色',
    clickHint: '在圖片上移動可預覽，點擊即可保存顏色。',
    recent: '取色紀錄',
    empty: '尚無取色紀錄，點擊圖片即可加入。',
    clear: '清除紀錄',
  },
  en: {
    uploadHint: 'Upload an image to start picking colors',
    hover: 'Hovered color',
    clickHint: 'Move over the image to preview, click to save a color.',
    recent: 'Picked colors',
    empty: 'No colors picked yet. Click the image to add one.',
    clear: 'Clear history',
  },
}
