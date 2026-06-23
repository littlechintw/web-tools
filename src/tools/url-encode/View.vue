<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'url-encode'
const { t } = useI18n()
const route = useRoute()

type Mode = 'encode' | 'decode'
type Scope = 'component' | 'full'

const history = useHistory<{ mode: Mode; scope: Scope; input: string }>(TOOL_ID)

const mode = ref<Mode>('encode')
const scope = ref<Scope>('component')
const input = ref('')
const error = ref('')

const output = computed(() => {
  error.value = ''
  if (!input.value) return ''
  try {
    if (mode.value === 'encode') {
      return scope.value === 'component'
        ? encodeURIComponent(input.value)
        : encodeURI(input.value)
    } else {
      return scope.value === 'component'
        ? decodeURIComponent(input.value)
        : decodeURI(input.value)
    }
  } catch {
    error.value = t('tools.url-encode.decodeError')
    return ''
  }
})

function save() {
  if (!input.value) return
  const label = `${t('tools.url-encode.' + mode.value)}: ${input.value.slice(0, 40)}`
  history.save(label, { mode: mode.value, scope: scope.value, input: input.value })
}

watch([input, mode, scope], () => save())

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      mode.value = e.data.mode
      scope.value = e.data.scope
      input.value = e.data.input
    }
  }
})
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="encode">{{ t('tools.url-encode.encode') }}</v-btn>
        <v-btn value="decode">{{ t('tools.url-encode.decode') }}</v-btn>
      </v-btn-toggle>
      <v-btn-toggle v-model="scope" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="component">{{ t('tools.url-encode.component') }}</v-btn>
        <v-btn value="full">{{ t('tools.url-encode.full') }}</v-btn>
      </v-btn-toggle>
    </div>

    <v-textarea
      v-model="input"
      :label="mode === 'encode' ? t('tools.url-encode.inputText') : t('tools.url-encode.inputEncoded')"
      rows="5"
      auto-grow
      clearable
      class="code-area"
    />

    <v-textarea
      :model-value="output"
      :label="t('common.output')"
      :error-messages="error"
      rows="5"
      auto-grow
      readonly
      class="code-area mt-2"
    />

    <div class="d-flex ga-2 mt-2">
      <CopyBtn :text="output" />
    </div>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
