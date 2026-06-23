import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'regex-tester',
  route: 'regex-tester',
  category: 'text',
  icon: 'mdi-regex',
  title: { 'zh-TW': '正則表達式測試', en: 'Regex Tester' },
  description: {
    'zh-TW': '即時測試正則表達式，顯示匹配與擷取群組。',
    en: 'Test regular expressions live with matches and capture groups.',
  },
  keywords: ['regex', 'regexp', 'pattern', 'match', '正則', '正規', '表達式'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    pattern: '正則表達式',
    flags: '旗標',
    testString: '測試字串',
    matchCount: '匹配數：{n}',
    noMatch: '沒有匹配。',
    match: '匹配 #{n}',
    indexAt: '位置 {i}',
    groups: '擷取群組',
    group: '群組 {n}',
    namedGroup: '群組「{name}」',
    invalidRegex: '無效的正則表達式：{msg}',
  },
  en: {
    pattern: 'Pattern',
    flags: 'Flags',
    testString: 'Test string',
    matchCount: 'Matches: {n}',
    noMatch: 'No matches.',
    match: 'Match #{n}',
    indexAt: 'at index {i}',
    groups: 'Capture groups',
    group: 'Group {n}',
    namedGroup: 'Group "{name}"',
    invalidRegex: 'Invalid regex: {msg}',
  },
}
