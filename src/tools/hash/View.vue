<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { md5 as md5Hash } from '@/utils/md5'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import FileDrop from '@/components/FileDrop.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'hash'
const { t } = useI18n()
const route = useRoute()

type Mode = 'text' | 'file'
const history = useHistory<{ input: string }>(TOOL_ID)

const mode = ref<Mode>('text')
const input = ref('')
const uppercase = ref(false)
const fileName = ref('')
const computing = ref(false)

const SUBTLE_ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const

const results = ref<Record<string, string>>({})

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

async function hashBuffer(buf: ArrayBuffer): Promise<Record<string, string>> {
  const out: Record<string, string> = { MD5: md5Hash(buf) }
  for (const algo of SUBTLE_ALGOS) {
    const digest = await crypto.subtle.digest(algo, buf)
    out[algo] = bufToHex(digest)
  }
  return out
}

async function computeText() {
  computing.value = true
  try {
    if (!input.value) {
      results.value = {}
      return
    }
    const bytes = new TextEncoder().encode(input.value)
    const buf = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buf).set(bytes)
    results.value = await hashBuffer(buf)
  } finally {
    computing.value = false
  }
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  fileName.value = file.name
  computing.value = true
  try {
    const buf = await file.arrayBuffer()
    results.value = await hashBuffer(buf)
  } finally {
    computing.value = false
  }
}

const displayResults = computed(() => {
  const out: Array<{ algo: string; value: string }> = []
  const order = ['MD5', ...SUBTLE_ALGOS]
  for (const algo of order) {
    const v = results.value[algo]
    if (v === undefined) continue
    out.push({ algo, value: uppercase.value ? v.toUpperCase() : v })
  }
  return out
})

function save() {
  if (mode.value !== 'text' || !input.value) return
  history.save(`${input.value.slice(0, 40)}`, { input: input.value })
}

watch(input, () => {
  if (mode.value === 'text') {
    void computeText()
    save()
  }
})

watch(mode, (m) => {
  results.value = {}
  if (m === 'text') void computeText()
  else fileName.value = ''
})

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      mode.value = 'text'
      input.value = e.data.input
    }
  }
})
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="text">{{ t('tools.hash.text') }}</v-btn>
        <v-btn value="file">{{ t('tools.hash.file') }}</v-btn>
      </v-btn-toggle>
      <v-checkbox v-model="uppercase" :label="t('tools.hash.uppercase')" hide-details density="compact" />
    </div>

    <v-textarea
      v-if="mode === 'text'"
      v-model="input"
      :label="t('tools.hash.inputText')"
      rows="4"
      auto-grow
      clearable
      class="code-area"
    />

    <template v-else>
      <FileDrop @files="onFiles" />
      <div v-if="fileName" class="text-body-2 text-medium-emphasis mt-2">
        {{ t('tools.hash.selectedFile') }}: {{ fileName }}
      </div>
    </template>

    <v-progress-linear v-if="computing" indeterminate color="primary" class="mt-3" />

    <div v-for="r in displayResults" :key="r.algo" class="mt-3">
      <div class="text-caption text-medium-emphasis">{{ r.algo }}</div>
      <div class="d-flex align-center ga-2">
        <v-text-field :model-value="r.value" readonly hide-details density="compact" class="code-field flex-grow-1" />
        <CopyBtn :text="r.value" icon />
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea),
.code-field :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
