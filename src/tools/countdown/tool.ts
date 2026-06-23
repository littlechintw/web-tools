import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'countdown',
  route: 'countdown',
  category: 'datetime',
  icon: 'mdi-timer-sand',
  order: 2,
  title: { 'zh-TW': '倒數計時器', en: 'Countdown Timer' },
  description: {
    'zh-TW': '倒數到指定的日期時間，或設定時長後啟動倒數計時並在結束時嗶聲提醒。',
    en: 'Count down to a target date/time, or run a duration timer that beeps when it finishes.',
  },
  keywords: ['countdown', 'timer', 'duration', '倒數', '計時', '時間'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    modeTarget: '目標時間',
    modeDuration: '時長計時',
    targetDateTime: '目標日期時間',
    reached: '時間到！',
    days: '天',
    hours: '時',
    minutes: '分',
    seconds: '秒',
    setDuration: '設定時長',
    minutesLabel: '分鐘',
    secondsLabel: '秒',
    start: '開始',
    pause: '暫停',
    resume: '繼續',
    reset: '重設',
    finished: '倒數結束',
  },
  en: {
    modeTarget: 'Target time',
    modeDuration: 'Duration timer',
    targetDateTime: 'Target date & time',
    reached: "Time's up!",
    days: 'Days',
    hours: 'Hours',
    minutes: 'Min',
    seconds: 'Sec',
    setDuration: 'Set duration',
    minutesLabel: 'Minutes',
    secondsLabel: 'Seconds',
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    reset: 'Reset',
    finished: 'Countdown finished',
  },
}
