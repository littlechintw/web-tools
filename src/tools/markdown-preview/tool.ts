import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'markdown-preview',
  route: 'markdown-preview',
  category: 'text',
  icon: 'mdi-language-markdown',
  title: {
    'zh-TW': 'Markdown 預覽',
    en: 'Markdown Preview',
    ja: 'Markdown プレビュー',
    ko: 'Markdown 미리보기',
  },
  description: {
    'zh-TW': '即時渲染 Markdown 並安全淨化輸出 HTML。',
    en: 'Render Markdown live with sanitized HTML output.',
    ja: 'Markdown をリアルタイムでレンダリングし、安全にサニタイズした HTML を出力します。',
    ko: 'Markdown 을 실시간으로 렌더링하고 안전하게 정제된 HTML 을 출력합니다.',
  },
  keywords: ['markdown', 'md', 'preview', 'render', '預覽', '渲染', 'プレビュー', '미리보기'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    inputMd: '輸入 Markdown',
    preview: '預覽',
  },
  en: {
    inputMd: 'Input Markdown',
    preview: 'Preview',
  },
  ja: {
    inputMd: 'Markdown を入力',
    preview: 'プレビュー',
  },
  ko: {
    inputMd: 'Markdown 입력',
    preview: '미리보기',
  },
}
