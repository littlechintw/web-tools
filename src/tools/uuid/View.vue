<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { nanoid } from '@/utils/nanoid'
import ToolShell from '@/components/ToolShell.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { isBoolean, isNumber, useStoredRef } from '@/composables/useStoredRef'

const TOOL_ID = 'uuid'
const { t } = useI18n()
const T = (key: string) => t(`tools.${TOOL_ID}.${key}`)

type Tab = 'uuid' | 'nanoid'
const tab = ref<Tab>('uuid')
// Options are remembered between visits.
const count = useStoredRef('uuid.count', 5, isNumber)
const uppercase = useStoredRef('uuid.uppercase', false, isBoolean)
const removeHyphens = useStoredRef('uuid.removeHyphens', false, isBoolean)
const nanoidSize = useStoredRef('uuid.nanoidSize', 21, isNumber)

const items = ref<string[]>([])

function generate() {
  const c = Math.max(1, Math.min(100, Math.floor(count.value || 1)))
  const size = Math.max(2, Math.min(128, Math.floor(nanoidSize.value || 21)))
  const out: string[] = []
  for (let i = 0; i < c; i++) {
    if (tab.value === 'uuid') {
      let id: string = crypto.randomUUID()
      if (removeHyphens.value) id = id.replace(/-/g, '')
      if (uppercase.value) id = id.toUpperCase()
      out.push(id)
    } else {
      out.push(nanoid(size))
    }
  }
  items.value = out
}

const allText = computed(() => items.value.join('\n'))

watch([tab, count, uppercase, removeHyphens, nanoidSize], () => generate())
generate()
</script>

<template>
  <ToolShell>
    <v-tabs v-model="tab" color="primary" class="mb-4">
      <v-tab value="uuid">{{ T('uuidTab') }}</v-tab>
      <v-tab value="nanoid">{{ T('nanoidTab') }}</v-tab>
    </v-tabs>

    <div class="d-flex flex-wrap align-center ga-4">
      <v-text-field
        v-model.number="count"
        :label="T('count')"
        type="number"
        :min="1"
        :max="100"
        hide-details
        density="compact"
        style="max-width: 120px"
      />

      <template v-if="tab === 'uuid'">
        <v-checkbox v-model="uppercase" :label="T('uppercase')" hide-details density="compact" />
        <v-checkbox v-model="removeHyphens" :label="T('removeHyphens')" hide-details density="compact" />
      </template>

      <template v-else>
        <div style="min-width: 220px">
          <div class="d-flex justify-space-between">
            <span class="text-body-2">{{ T('nanoidSize') }}</span>
            <span class="text-body-2 font-weight-bold tabular-nums">{{ nanoidSize }}</span>
          </div>
          <v-slider v-model="nanoidSize" :min="2" :max="64" :step="1" hide-details />
        </div>
      </template>

      <v-btn prepend-icon="mdi-refresh" color="primary" variant="tonal" @click="generate">
        {{ T('regenerate') }}
      </v-btn>
    </div>

    <OutputPanel class="mt-4" :value="allText" :rows="8" filename="ids.txt" />
  </ToolShell>
</template>
