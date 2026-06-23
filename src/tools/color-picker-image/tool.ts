import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'color-picker-image',
  route: 'color-picker-image',
  category: 'media',
  icon: 'mdi-eyedropper',
  title: {
    'zh-TW': '圖片取色器',
    en: 'Image Color Picker',
    ja: '画像スポイト',
    ko: '이미지 색상 추출기',
  },
  description: {
    'zh-TW': '上傳圖片後在畫面上滑動取色，讀出 HEX 與 RGB，並保留取色紀錄。',
    en: 'Upload an image and hover/click to read the HEX & RGB of any pixel, with a picked-color history.',
    ja: '画像をアップロードしてマウスを動かすと任意のピクセルの HEX と RGB を読み取れます。取得した色の履歴も保存します。',
    ko: '이미지를 업로드한 뒤 마우스를 움직여 임의 픽셀의 HEX 와 RGB 값을 읽고, 추출한 색상 기록을 보관합니다.',
  },
  keywords: ['color', 'picker', 'eyedropper', 'hex', 'rgb', '取色', '顏色', 'スポイト', '色抽出', '스포이트', '색상 추출'],
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
  ja: {
    uploadHint: '画像をアップロードして色の取得を開始',
    hover: 'カーソル位置の色',
    clickHint: '画像上でマウスを動かすとプレビュー、クリックで色を保存します。',
    recent: '取得した色',
    empty: 'まだ色が取得されていません。画像をクリックして追加してください。',
    clear: '履歴をクリア',
  },
  ko: {
    uploadHint: '이미지를 업로드하여 색상 추출 시작',
    hover: '커서 위치 색상',
    clickHint: '이미지 위에서 마우스를 움직이면 미리보기, 클릭하면 색상이 저장됩니다.',
    recent: '추출한 색상',
    empty: '아직 추출한 색상이 없습니다. 이미지를 클릭하여 추가하세요.',
    clear: '기록 지우기',
  },
}
