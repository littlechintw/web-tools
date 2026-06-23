<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const { t } = useI18n()

const ipInput = ref('192.168.1.10')
const prefix = ref(24)
const error = ref('')

// Allow pasting "ip/prefix" into the IP field — split it out.
watch(ipInput, (val) => {
  const m = val.match(/^(.*)\/(\d{1,2})\s*$/)
  if (m) {
    ipInput.value = m[1].trim()
    const p = Number(m[2])
    if (p >= 0 && p <= 32) prefix.value = p
  }
})

function parseIp(s: string): number | null {
  const parts = s.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const v = Number(part)
    if (v > 255) return null
    n = (n << 8) | v
  }
  return n >>> 0
}

function intToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.')
}

function ipClass(firstOctet: number): string {
  if (firstOctet < 128) return 'A'
  if (firstOctet < 192) return 'B'
  if (firstOctet < 224) return 'C'
  if (firstOctet < 240) return 'D (multicast)'
  return 'E (reserved)'
}

interface Result {
  network: string
  broadcast: string
  netmask: string
  wildcard: string
  firstHost: string
  lastHost: string
  totalHosts: string
  usableHosts: string
  ipClass: string
}

const result = computed<Result | null>(() => {
  error.value = ''
  const ip = parseIp(ipInput.value)
  const p = prefix.value
  if (ip === null || !Number.isInteger(p) || p < 0 || p > 32) {
    if (ipInput.value.trim()) error.value = t('tools.ip-subnet.errInvalid')
    return null
  }

  const mask = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0
  const wildcard = (~mask) >>> 0
  const network = (ip & mask) >>> 0
  const broadcast = (network | wildcard) >>> 0

  const total = p >= 32 ? 1 : 2 ** (32 - p)
  let usable: number
  let firstHost: string
  let lastHost: string
  if (p >= 31) {
    // /31 and /32: no traditional usable host range.
    usable = p === 32 ? 1 : 2
    firstHost = intToIp(network)
    lastHost = intToIp(broadcast)
  } else {
    usable = total - 2
    firstHost = intToIp((network + 1) >>> 0)
    lastHost = intToIp((broadcast - 1) >>> 0)
  }

  return {
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    netmask: intToIp(mask),
    wildcard: intToIp(wildcard),
    firstHost,
    lastHost,
    totalHosts: total.toLocaleString(),
    usableHosts: usable.toLocaleString(),
    ipClass: ipClass((ip >>> 24) & 0xff),
  }
})
</script>

<template>
  <ToolShell>
    <v-row dense>
      <v-col cols="12" sm="8">
        <v-text-field
          v-model="ipInput"
          :label="t('tools.ip-subnet.ip')"
          :hint="t('tools.ip-subnet.cidrHint')"
          persistent-hint
          class="code-area"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field
          v-model.number="prefix"
          type="number"
          :min="0"
          :max="32"
          :label="t('tools.ip-subnet.prefix')"
          prefix="/"
        />
      </v-col>
    </v-row>

    <v-alert v-if="error" type="error" variant="tonal" class="mt-2">{{ error }}</v-alert>

    <v-table v-if="result" class="mt-3 rounded-lg border" density="comfortable">
      <tbody>
        <tr v-for="(item, idx) in [
          { key: 'network', val: result.network, copy: true },
          { key: 'broadcast', val: result.broadcast, copy: true },
          { key: 'netmask', val: result.netmask, copy: true },
          { key: 'wildcard', val: result.wildcard, copy: true },
          { key: 'firstHost', val: result.firstHost, copy: true },
          { key: 'lastHost', val: result.lastHost, copy: true },
          { key: 'totalHosts', val: result.totalHosts, copy: false },
          { key: 'usableHosts', val: result.usableHosts, copy: false },
          { key: 'ipClass', val: result.ipClass, copy: false },
        ]" :key="idx">
          <td class="font-weight-medium">{{ t('tools.ip-subnet.' + item.key) }}</td>
          <td class="mono">{{ item.val }}</td>
          <td class="text-right" style="width: 56px">
            <CopyBtn v-if="item.copy" :text="item.val" icon size="small" />
          </td>
        </tr>
      </tbody>
    </v-table>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
