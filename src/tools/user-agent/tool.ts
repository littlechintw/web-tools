import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'user-agent',
  route: 'user-agent',
  category: 'dev',
  icon: 'mdi-monitor-cellphone',
  title: { 'zh-TW': 'User-Agent 解析', en: 'User-Agent Parser' },
  description: {
    'zh-TW': '解析 User-Agent 字串，辨識瀏覽器、引擎、作業系統與裝置。',
    en: 'Parse a User-Agent string to identify browser, engine, OS and device.',
  },
  keywords: ['user agent', 'ua', 'browser', 'os', 'device', '瀏覽器', '裝置'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    input: 'User-Agent 字串',
    useCurrent: '使用目前瀏覽器',
    field: '項目',
    value: '數值',
    browser: '瀏覽器',
    version: '版本',
    engine: '引擎',
    os: '作業系統',
    device: '裝置',
    vendor: '廠商',
    model: '型號',
    type: '類型',
    cpu: 'CPU 架構',
    unknown: '未知',
  },
  en: {
    input: 'User-Agent string',
    useCurrent: 'Use current browser',
    field: 'Field',
    value: 'Value',
    browser: 'Browser',
    version: 'Version',
    engine: 'Engine',
    os: 'OS',
    device: 'Device',
    vendor: 'Vendor',
    model: 'Model',
    type: 'Type',
    cpu: 'CPU architecture',
    unknown: 'Unknown',
  },
}
