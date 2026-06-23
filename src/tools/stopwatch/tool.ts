import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'stopwatch',
  route: 'stopwatch',
  category: 'datetime',
  icon: 'mdi-timer-outline',
  order: 3,
  title: {
    'zh-TW': '碼錶',
    en: 'Stopwatch',
    ja: 'ストップウォッチ',
    ko: '스톱워치',
  },
  description: {
    'zh-TW': '高精度碼錶，支援開始、暫停、重設與分段計時（Lap）。',
    en: 'High-precision stopwatch with start, pause, reset and lap timing.',
    ja: '高精度のストップウォッチ。開始、一時停止、リセット、ラップ計測に対応。',
    ko: '고정밀 스톱워치로 시작, 일시정지, 초기화, 랩 타임 측정을 지원합니다.',
  },
  keywords: ['stopwatch', 'lap', 'timer', '碼錶', '計時', '分段', 'ストップウォッチ', '스톱워치'],
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
  ja: {
    start: '開始',
    pause: '一時停止',
    resume: '再開',
    reset: 'リセット',
    lap: 'ラップ',
    lapNo: 'ラップ',
    lapTime: 'ラップタイム',
    split: 'スプリット',
    total: '合計',
  },
  ko: {
    start: '시작',
    pause: '일시정지',
    resume: '계속',
    reset: '초기화',
    lap: '랩',
    lapNo: '랩',
    lapTime: '랩 타임',
    split: '구간',
    total: '합계',
  },
}
