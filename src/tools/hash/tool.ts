import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'hash',
  route: 'hash',
  category: 'encode',
  icon: 'mdi-pound',
  title: { 'zh-TW': '雜湊產生器', en: 'Hash Generator', ja: 'ハッシュ生成', ko: '해시 생성기' },
  description: {
    'zh-TW': '計算文字或檔案的 MD5、SHA-1、SHA-256、SHA-384、SHA-512 雜湊值。',
    en: 'Compute MD5, SHA-1, SHA-256, SHA-384 and SHA-512 hashes of text or a file.',
    ja: 'テキストやファイルの MD5、SHA-1、SHA-256、SHA-384、SHA-512 ハッシュ値を計算します。',
    ko: '텍스트나 파일의 MD5, SHA-1, SHA-256, SHA-384, SHA-512 해시 값을 계산합니다.',
  },
  keywords: ['hash', 'md5', 'sha', 'sha256', 'sha512', 'checksum', '雜湊', '校驗碼', 'ハッシュ', '해시'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    text: '文字',
    file: '檔案',
    inputText: '輸入文字',
    uppercase: '大寫輸出',
    selectedFile: '已選檔案',
    computing: '計算中…',
  },
  en: {
    text: 'Text',
    file: 'File',
    inputText: 'Input text',
    uppercase: 'Uppercase output',
    selectedFile: 'Selected file',
    computing: 'Computing…',
  },
  ja: {
    text: 'テキスト',
    file: 'ファイル',
    inputText: 'テキストを入力',
    uppercase: '大文字で出力',
    selectedFile: '選択したファイル',
    computing: '計算中…',
  },
  ko: {
    text: '텍스트',
    file: '파일',
    inputText: '텍스트 입력',
    uppercase: '대문자로 출력',
    selectedFile: '선택한 파일',
    computing: '계산 중…',
  },
}
