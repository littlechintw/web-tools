import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'qr-scan',
  route: 'qr-scan',
  category: 'media',
  icon: 'mdi-qrcode-scan',
  title: { 'zh-TW': 'QR Code / 條碼掃描', en: 'QR Code / Barcode Scanner' },
  description: {
    'zh-TW': '用相機即時掃描，或上傳圖片解析 QR Code 與各式條碼。',
    en: 'Scan live with your camera or upload an image to decode QR codes and barcodes.',
  },
  keywords: ['qr', 'qrcode', 'barcode', 'scan', '掃描', '條碼', 'zxing'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    camera: '相機掃描',
    image: '圖片解析',
    start: '開始掃描',
    stop: '停止掃描',
    scanning: '掃描中…',
    result: '掃描結果',
    open: '開啟連結',
    uploadHint: '上傳含 QR Code / 條碼的圖片',
    noResult: '尚未掃描到任何內容。',
    errPermission: '無法存取相機，請確認已授權相機權限。',
    errNoCamera: '找不到可用的相機裝置。',
    errDecode: '無法從圖片中解析出條碼。',
  },
  en: {
    camera: 'Camera',
    image: 'Image',
    start: 'Start scan',
    stop: 'Stop scan',
    scanning: 'Scanning…',
    result: 'Scan result',
    open: 'Open link',
    uploadHint: 'Upload an image containing a QR code / barcode',
    noResult: 'Nothing scanned yet.',
    errPermission: 'Cannot access the camera. Please grant camera permission.',
    errNoCamera: 'No camera device available.',
    errDecode: 'Could not decode a barcode from the image.',
  },
}
