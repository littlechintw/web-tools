import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'stopwatch',
  route: 'stopwatch',
  category: 'datetime',
  icon: 'mdi-timer-outline',
  order: 3,
  title: { 'zh-TW': '碼錶', en: 'Stopwatch' },
  description: {
    'zh-TW': '高精度碼錶，支援開始、暫停、重設與分段計時（Lap）。',
    en: 'High-precision stopwatch with start, pause, reset and lap timing.',
  },
  keywords: ['stopwatch', 'lap', 'timer', '碼錶', '計時', '分段'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    start: '開始',
    pause: '暫停',
    resume: '繼續',
    reset: '重設',
    lap: '分段',
    lapNo: '分段',
    lapTime: '分段時間',
    split: '間隔',
    total: '總計',
  },
  en: {
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    reset: 'Reset',
    lap: 'Lap',
    lapNo: 'Lap',
    lapTime: 'Lap time',
    split: 'Split',
    total: 'Total',
  },
}
