<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { isBoolean, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { decodeEntities, encodeEntities } from '@/lib/htmlEntities'

const TOOL_ID = 'html-entities'
const { t } = useI18n()
const T = (key: string) => t(`tools.${TOOL_ID}.${key}`)

const mode = useStoredRef<'encode' | 'decode'>('html-entities.mode', 'encode', oneOf(['encode', 'decode'] as const))
const scope = useStoredRef<'basic' | 'all'>('html-entities.scope', 'basic', oneOf(['basic', 'all'] as const))
const named = useStoredRef('html-entities.named', true, isBoolean)
const numeric = useStoredRef<'decimal' | 'hex'>('html-entities.numeric', 'decimal', oneOf(['decimal', 'hex'] as const))

const input = ref('')

const modeItems = computed(() => [
  { title: T('encode'), value: 'encode' },
  { title: T('decode'), value: 'decode' },
])
const scopeItems = computed(() => [
  { title: T('scopeBasic'), value: 'basic' },
  { title: T('scopeAll'), value: 'all' },
])
const numericItems = computed(() => [
  { title: T('decimal'), value: 'decimal' },
  { title: T('hex'), value: 'hex' },
])

const output = computed(() =>
  mode.value === 'encode'
    ? encodeEntities(input.value, { scope: scope.value, named: named.value, numeric: numeric.value })
    : decodeEntities(input.value),
)

function swap() {
  input.value = output.value
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
}

function loadExample() {
  if (mode.value === 'encode') input.value = '<a href="/cafe">Café & Crème — ©2025 😀 中文</a>'
  else input.value = '&lt;p&gt;Caf&eacute; &amp; Cr&egrave;me &mdash; &#169;2025 &#x1F600; &#20013;&#x6587;&lt;/p&gt;'
}
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-3 mb-4">
      <v-btn-toggle v-model="mode" mandatory density="comfortable" variant="outlined" color="primary" divided>
        <v-btn v-for="m in modeItems" :key="m.value" :value="m.value">{{ m.title }}</v-btn>
      </v-btn-toggle>
      <v-btn icon="mdi-swap-vertical" variant="text" :title="t('common.swap')" :aria-label="t('common.swap')" @click="swap" />
    </div>

    <v-row v-if="mode === 'encode'" density="comfortable" class="mb-1" align="center">
      <v-col cols="12" sm="5"><v-select v-model="scope" :items="scopeItems" :label="T('scope')" density="compact" hide-details /></v-col>
      <v-col cols="6" sm="3"><v-select v-model="numeric" :items="numericItems" :label="T('numericStyle')" density="compact" hide-details /></v-col>
      <v-col cols="6" sm="4"><v-switch v-model="named" :label="T('useNamed')" density="compact" hide-details color="primary" /></v-col>
    </v-row>

    <v-textarea v-model="input" :label="t('common.input')" rows="6" auto-grow max-rows="16" clearable hide-details class="code-area" spellcheck="false" />
    <div class="d-flex flex-wrap align-center ga-2 mt-2">
      <PasteBtn @paste="input = $event" />
      <v-btn variant="text" prepend-icon="mdi-lightbulb-outline" @click="loadExample">{{ t('common.loadExample') }}</v-btn>
    </div>

    <OutputPanel class="mt-4" :value="output" :rows="6" filename="entities.txt" />
    <p class="text-caption text-medium-emphasis mt-2 mb-0">{{ T('tableNote') }}</p>
  </ToolShell>
</template>
