<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { nanoid } from '@/utils/nanoid'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const { t } = useI18n()

type Tab = 'uuid' | 'nanoid'
const tab = ref<Tab>('uuid')
const count = ref(5)
const uppercase = ref(false)
const removeHyphens = ref(false)
const nanoidSize = ref(21)

const items = ref<string[]>([])

function generate() {
  const out: string[] = []
  for (let i = 0; i < count.value; i++) {
    if (tab.value === 'uuid') {
      let id: string = crypto.randomUUID()
      if (removeHyphens.value) id = id.replace(/-/g, '')
      if (uppercase.value) id = id.toUpperCase()
      out.push(id)
    } else {
      out.push(nanoid(nanoidSize.value))
    }
  }
  items.value = out
}

const allText = computed(() => items.value.join('\n'))

onMounted(() => generate())
</script>

<template>
  <ToolShell>
    <v-tabs v-model="tab" color="primary" class="mb-4" @update:model-value="generate">
      <v-tab value="uuid">{{ t('tools.uuid.uuidTab') }}</v-tab>
      <v-tab value="nanoid">{{ t('tools.uuid.nanoidTab') }}</v-tab>
    </v-tabs>

    <div class="d-flex flex-wrap align-center ga-4">
      <v-text-field
        v-model.number="count"
        :label="t('tools.uuid.count')"
        type="number"
        :min="1"
        :max="100"
        hide-details
        density="compact"
        style="max-width: 120px"
        @update:model-value="generate"
      />

      <template v-if="tab === 'uuid'">
        <v-checkbox v-model="uppercase" :label="t('tools.uuid.uppercase')" hide-details density="compact" @update:model-value="generate" />
        <v-checkbox v-model="removeHyphens" :label="t('tools.uuid.removeHyphens')" hide-details density="compact" @update:model-value="generate" />
      </template>

      <template v-else>
        <div style="min-width: 220px">
          <div class="d-flex justify-space-between">
            <span class="text-body-2">{{ t('tools.uuid.nanoidSize') }}</span>
            <span class="text-body-2 font-weight-bold">{{ nanoidSize }}</span>
          </div>
          <v-slider v-model="nanoidSize" :min="2" :max="64" :step="1" hide-details @update:model-value="generate" />
        </div>
      </template>

      <v-btn prepend-icon="mdi-refresh" color="primary" variant="tonal" @click="generate">
        {{ t('tools.uuid.regenerate') }}
      </v-btn>
    </div>

    <v-textarea
      :model-value="allText"
      readonly
      rows="8"
      auto-grow
      class="code-area mt-4"
    />

    <div class="d-flex ga-2 mt-2">
      <CopyBtn :text="allText" />
    </div>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
