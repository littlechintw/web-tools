<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { UAParser } from '@/utils/uaParser'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const { t } = useI18n()

const ua = ref(navigator.userAgent)

interface Row {
  label: string
  value: string
}

function join(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ').trim()
}

const rows = computed<Row[]>(() => {
  if (!ua.value.trim()) return []
  const r = UAParser(ua.value)
  const unknown = t('tools.user-agent.unknown')
  const pick = (v: string) => v || unknown
  return [
    { label: t('tools.user-agent.browser'), value: pick(join(r.browser.name, r.browser.version)) },
    { label: t('tools.user-agent.engine'), value: pick(join(r.engine.name, r.engine.version)) },
    { label: t('tools.user-agent.os'), value: pick(join(r.os.name, r.os.version)) },
    { label: t('tools.user-agent.device'), value: pick(join(r.device.vendor, r.device.model)) },
    { label: t('tools.user-agent.type'), value: pick(r.device.type ?? '') },
    { label: t('tools.user-agent.cpu'), value: pick(r.cpu.architecture ?? '') },
  ]
})

function useCurrent() {
  ua.value = navigator.userAgent
}
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="ua"
      :label="t('tools.user-agent.input')"
      rows="3"
      auto-grow
      clearable
      class="code-area"
    />
    <div class="d-flex flex-wrap ga-2 mt-1">
      <CopyBtn :text="ua" />
      <v-btn variant="outlined" prepend-icon="mdi-refresh" @click="useCurrent">
        {{ t('tools.user-agent.useCurrent') }}
      </v-btn>
    </div>

    <v-table v-if="rows.length" class="mt-4 rounded-lg border" density="comfortable">
      <thead>
        <tr>
          <th class="text-left">{{ t('tools.user-agent.field') }}</th>
          <th class="text-left">{{ t('tools.user-agent.value') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.label">
          <td class="font-weight-medium">{{ row.label }}</td>
          <td>{{ row.value }}</td>
        </tr>
      </tbody>
    </v-table>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
</style>
