<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { calcSubnet } from '@/lib/ipSubnet'

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

const result = computed(() => {
  error.value = ''
  const r = calcSubnet(ipInput.value, prefix.value)
  if (!r && ipInput.value.trim()) error.value = t('tools.ip-subnet.errInvalid')
  if (!r) return null
  return {
    ...r,
    totalHosts: r.totalHosts.toLocaleString(),
    usableHosts: r.usableHosts.toLocaleString(),
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
