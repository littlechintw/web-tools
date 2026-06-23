import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'json-format',
  route: 'json-format',
  category: 'text',
  icon: 'mdi-code-json',
  title: { 'zh-TW': 'JSON 格式化 / 驗證', en: 'JSON Format / Validate' },
  description: {
    'zh-TW': '格式化、壓縮、排序鍵並即時驗證 JSON。',
    en: 'Format, minify, sort keys and validate JSON live.',
  },
  keywords: ['json', 'format', 'minify', 'validate', 'pretty', '格式化', '壓縮', '驗證'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    inputJson: '輸入 JSON',
    format: '格式化',
    minify: '壓縮',
    sortKeys: '排序鍵',
    indent: '縮排',
    indent2: '2 空格',
    indent4: '4 空格',
    indentTab: 'Tab',
    valid: 'JSON 有效',
    parseError: '解析錯誤：{msg}',
    download: '下載 .json',
  },
  en: {
    inputJson: 'Input JSON',
    format: 'Format',
    minify: 'Minify',
    sortKeys: 'Sort keys',
    indent: 'Indent',
    indent2: '2 spaces',
    indent4: '4 spaces',
    indentTab: 'Tab',
    valid: 'Valid JSON',
    parseError: 'Parse error: {msg}',
    download: 'Download .json',
  },
}
