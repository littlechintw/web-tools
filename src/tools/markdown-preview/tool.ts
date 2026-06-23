import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'markdown-preview',
  route: 'markdown-preview',
  category: 'text',
  icon: 'mdi-language-markdown',
  title: { 'zh-TW': 'Markdown 預覽', en: 'Markdown Preview' },
  description: {
    'zh-TW': '即時渲染 Markdown 並安全淨化輸出 HTML。',
    en: 'Render Markdown live with sanitized HTML output.',
  },
  keywords: ['markdown', 'md', 'preview', 'render', '預覽', '渲染'],
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
}
