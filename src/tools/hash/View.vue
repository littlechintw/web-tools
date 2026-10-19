<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { md5 as md5Hash } from '@/utils/md5'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import FileDrop from '@/components/FileDrop.vue'
import { useHistory } from '@/composables/useHistory'
import { isBoolean, useStoredRef } from '@/composables/useStoredRef'
import { bytesToHex } from '@/utils/bytes'

const TOOL_ID = 'hash'
const { t } = useI18n()

type Mode = 'text' | 'file'
const history = useHistory<{ input: string }>(TOOL_ID)

const mode = ref<Mode>('text')
const input = ref('')
// A display preference, remembered between visits.
const uppercase = useStoredRef('hash.uppercase', false, isBoolean)
const computing = ref(false)

const SUBTLE_ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const

const results = ref<Record<string, string>>({})

async function hashBuffer(buf: ArrayBuffer): Promise<Record<string, string>> {
  const out: Record<string, string> = { MD5: md5Hash(buf) }
  for (const algo of SUBTLE_ALGOS) {
    const digest = await crypto.subtle.digest(algo, buf)
    out[algo] = bytesToHex(digest)
  }
  return out
}

// Increment on every new computation so a stale async result (e.g. a large
// file that finishes after the user switched back to text) can't overwrite
// the current one.
let computeSeq = 0

async function computeText() {
  const seq = ++computeSeq
  computing.value = true
  try {
    if (!input.value) {
      if (seq === computeSeq) results.value = {}
      return
    }
    const bytes = new TextEncoder().encode(input.value)
    const buf = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buf).set(bytes)
    const res = await hashBuffer(buf)
    if (seq === computeSeq) results.value = res
  } finally {
    if (seq === computeSeq) computing.value = false
  }
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  const seq = ++computeSeq
  computing.value = true
  try {
    const buf = await file.arrayBuffer()
    const res = await hashBuffer(buf)
    if (seq === computeSeq) results.value = res
  } finally {
    if (seq === computeSeq) computing.value = false
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

const allText = computed(() => displayResults.value.map((r) => `${r.algo}: ${r.value}`).join('\n'))

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
})

history.restoreFromRoute((d) => {
  mode.value = 'text'
  input.value = d.input
})
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined" divided>
        <v-btn value="text" prepend-icon="mdi-text">{{ t('tools.hash.text') }}</v-btn>
        <v-btn value="file" prepend-icon="mdi-file-outline">{{ t('tools.hash.file') }}</v-btn>
      </v-btn-toggle>
      <v-checkbox v-model="uppercase" :label="t('tools.hash.uppercase')" hide-details density="compact" />
    </div>

    <template v-if="mode === 'text'">
      <v-textarea
        v-model="input"
        :label="t('tools.hash.inputText')"
        rows="4"
        auto-grow
        clearable
        hide-details
        class="code-area"
      />
      <div class="d-flex flex-wrap align-center ga-2 mt-2">
        <PasteBtn @paste="input = $event" />
      </div>
    </template>

    <FileDrop v-else @files="onFiles" />

    <v-progress-linear v-if="computing" indeterminate color="primary" class="mt-3" />

    <template v-if="displayResults.length">
      <div v-for="r in displayResults" :key="r.algo" class="mt-3">
        <div class="text-caption text-medium-emphasis">{{ r.algo }}</div>
        <div class="d-flex align-center ga-2">
          <v-text-field :model-value="r.value" readonly hide-details density="compact" class="code-area flex-grow-1" />
          <CopyBtn :text="r.value" icon />
        </div>
      </div>

      <div class="d-flex align-center justify-end ga-1 mt-3">
        <span class="text-caption text-medium-emphasis">{{ t('tools.hash.copyAll') }}</span>
        <CopyBtn :text="allText" icon size="small" />
      </div>
    </template>
  </ToolShell>
</template>
