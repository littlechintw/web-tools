import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'cron-parser',
  route: 'cron-parser',
  category: 'dev',
  icon: 'mdi-calendar-clock',
  title: { 'zh-TW': 'Cron 表達式解析', en: 'Cron Expression Parser' },
  description: {
    'zh-TW': '解析 Cron 表達式，給出白話說明並列出接下來的執行時間。',
    en: 'Parse a cron expression into a human description and the next scheduled runs.',
  },
  keywords: ['cron', 'crontab', 'schedule', '排程', 'cronstrue', '表達式'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    expression: 'Cron 表達式',
    description: '說明',
    nextRuns: '接下來的執行時間',
    presets: '常用範本',
    everyMinute: '每分鐘',
    hourly: '每小時',
    dailyMidnight: '每天午夜',
    weekly: '每週',
    monthly: '每月',
    englishFallback: '（找不到中文語系，以英文顯示）',
    errInvalid: '無效的 Cron 表達式。',
  },
  en: {
    expression: 'Cron expression',
    description: 'Description',
    nextRuns: 'Next runs',
    presets: 'Common presets',
    everyMinute: 'Every minute',
    hourly: 'Hourly',
    dailyMidnight: 'Daily at midnight',
    weekly: 'Weekly',
    monthly: 'Monthly',
    englishFallback: '(Chinese locale unavailable, showing English)',
    errInvalid: 'Invalid cron expression.',
  },
}
