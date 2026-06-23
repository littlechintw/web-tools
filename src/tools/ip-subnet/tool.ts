import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'ip-subnet',
  route: 'ip-subnet',
  category: 'dev',
  icon: 'mdi-ip-network',
  title: { 'zh-TW': 'IP 子網路計算器', en: 'IP Subnet Calculator' },
  description: {
    'zh-TW': '輸入 IPv4 與 CIDR 前綴，計算網路位址、廣播位址、遮罩與可用主機範圍。',
    en: 'Enter an IPv4 + CIDR prefix to compute network, broadcast, masks and the usable host range.',
  },
  keywords: ['ip', 'subnet', 'cidr', 'netmask', 'network', '子網路', '遮罩'],
}

export const messages: ToolMessages = {
  'zh-TW': {
    ip: 'IP 位址',
    prefix: 'CIDR 前綴',
    cidrHint: '可直接輸入如 192.168.1.10/24',
    network: '網路位址',
    broadcast: '廣播位址',
    netmask: '子網路遮罩',
    wildcard: '萬用遮罩',
    hostRange: '可用主機範圍',
    firstHost: '第一個主機',
    lastHost: '最後一個主機',
    totalHosts: '總位址數',
    usableHosts: '可用主機數',
    ipClass: 'IP 等級',
    errInvalid: '無效的 IPv4 位址或 CIDR 前綴（0–32）。',
  },
  en: {
    ip: 'IP address',
    prefix: 'CIDR prefix',
    cidrHint: 'You can paste e.g. 192.168.1.10/24',
    network: 'Network address',
    broadcast: 'Broadcast address',
    netmask: 'Subnet mask',
    wildcard: 'Wildcard mask',
    hostRange: 'Usable host range',
    firstHost: 'First host',
    lastHost: 'Last host',
    totalHosts: 'Total addresses',
    usableHosts: 'Usable hosts',
    ipClass: 'IP class',
    errInvalid: 'Invalid IPv4 address or CIDR prefix (0–32).',
  },
}
