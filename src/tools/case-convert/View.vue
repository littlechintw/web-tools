<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { toCases } from '@/lib/caseConvert'

const TOOL_ID = 'case-convert'
const { t } = useI18n()
const T = (key: string) => t(`tools.${TOOL_ID}.${key}`)

const input = ref('')
const rows = computed(() => toCases(input.value))

function loadExample() {
  input.value = 'user profile settings'
}
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="input"
      :label="T('inputText')"
      rows="3"
      auto-grow
      clearable
      hide-details
      class="code-area"
    />
    <div class="d-flex flex-wrap align-center ga-2 mt-2">
      <PasteBtn @paste="input = $event" />
      <v-btn variant="text" prepend-icon="mdi-lightbulb-outline" @click="loadExample">
        {{ t('common.loadExample') }}
      </v-btn>
    </div>

    <p v-if="!input" class="text-body-2 text-medium-emphasis text-center mt-4 mb-1">
      {{ T('emptyHint') }}
    </p>

    <v-table density="comfortable" class="mt-3">
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td class="text-medium-emphasis text-no-wrap" style="width: 160px">{{ row.key }}</td>
          <td class="font-mono break-all">
            <template v-if="row.value">{{ row.value }}</template>
            <span v-else class="text-disabled">—</span>
          </td>
          <td style="width: 56px" class="text-right">
            <CopyBtn :text="row.value" icon size="small" />
          </td>
        </tr>
      </tbody>
    </v-table>
  </ToolShell>
</template>
