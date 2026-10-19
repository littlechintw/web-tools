<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import PasteBtn from '@/components/PasteBtn.vue'
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

interface Row {
  key: string
  label: string
  value: string
  copy: boolean
}

const rows = computed<Row[]>(() => {
  const r = result.value
  if (!r) return []
  const row = (key: string, value: string, copy = true): Row => ({
    key,
    label: t(`tools.ip-subnet.${key}`),
    value,
    copy,
  })
  return [
    row('network', r.network),
    row('broadcast', r.broadcast),
    row('netmask', r.netmask),
    row('wildcard', r.wildcard),
    row('firstHost', r.firstHost),
    row('lastHost', r.lastHost),
    row('totalHosts', r.totalHosts, false),
    row('usableHosts', r.usableHosts, false),
    row('ipClass', r.ipClass, false),
  ]
})

const allText = computed(() => rows.value.map((r) => `${r.label}: ${r.value}`).join('\n'))
</script>

<template>
  <ToolShell>
    <v-row density="comfortable">
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
          class="code-area"
        />
      </v-col>
    </v-row>
    <div class="d-flex flex-wrap align-center ga-2">
      <PasteBtn @paste="ipInput = $event" />
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mt-2">{{ error }}</v-alert>

    <template v-if="rows.length">
      <v-row density="comfortable" class="mt-2">
        <v-col v-for="row in rows" :key="row.key" cols="12" md="6">
          <div class="d-flex align-center ga-2 rounded-lg border px-3 py-2">
            <div class="flex-grow-1 overflow-hidden">
              <div class="text-caption text-medium-emphasis">{{ row.label }}</div>
              <div class="font-mono break-all">{{ row.value }}</div>
            </div>
            <CopyBtn v-if="row.copy" :text="row.value" icon size="small" />
          </div>
        </v-col>
      </v-row>

      <div class="d-flex align-center justify-end ga-1 mt-2">
        <span class="text-caption text-medium-emphasis">{{ t('tools.ip-subnet.copyAll') }}</span>
        <CopyBtn :text="allText" icon size="small" />
      </div>
    </template>
  </ToolShell>
</template>
