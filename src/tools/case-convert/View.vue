<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { toCases } from '@/lib/caseConvert'

const { t } = useI18n()
const input = ref('')

const rows = computed(() => toCases(input.value))
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="input"
      :label="t('tools.case-convert.inputText')"
      rows="3"
      auto-grow
      clearable
      class="code-area"
    />

    <v-table density="comfortable" class="mt-3">
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td class="text-medium-emphasis" style="width: 160px; white-space: nowrap">{{ row.key }}</td>
          <td class="mono">{{ row.value }}</td>
          <td style="width: 56px" class="text-right">
            <CopyBtn :text="row.value" icon size="small" />
          </td>
        </tr>
      </tbody>
    </v-table>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
  word-break: break-all;
}
</style>
