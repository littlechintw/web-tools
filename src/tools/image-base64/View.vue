<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { dataUrlToBytes } from '@/utils/bytes'
import { downloadUrl } from '@/utils/download'
import { formatBytes, stripExtension } from '@/utils/format'
import { extensionForMime, readFileAsDataUrl } from '@/utils/image'

const TOOL_ID = 'image-base64'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

type Mode = 'toBase64' | 'toImage'
const mode = ref<Mode>('toBase64')

// --- Image → Base64 --------------------------------------------------------

const dataUri = ref('')
const fileName = ref('')
const fileSize = ref(0)
const sourceDims = ref<{ w: number; h: number } | null>(null)
const readError = ref('')

const byteSize = computed(() => new TextEncoder().encode(dataUri.value).length)
const baseName = computed(() => (fileName.value ? stripExtension(fileName.value) : 'image'))
const cssSnippet = computed(() => (dataUri.value ? `background-image: url("${dataUri.value}");` : ''))
const imgSnippet = computed(() => (dataUri.value ? `<img src="${dataUri.value}" alt="" />` : ''))

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  readError.value = ''
  sourceDims.value = null
  try {
    dataUri.value = await readFileAsDataUrl(file)
    fileName.value = file.name
    fileSize.value = file.size
  } catch {
    readError.value = t('common.error')
  }
}

function onSourceLoad(e: Event) {
  const img = e.target as HTMLImageElement
  sourceDims.value = { w: img.naturalWidth, h: img.naturalHeight }
}

// --- Base64 → Image --------------------------------------------------------

const pasted = ref('')
const pastedDims = ref<{ w: number; h: number } | null>(null)
// The header looked right but the browser couldn't decode the payload.
const pastedBroken = ref(false)

const previewSrc = computed(() => {
  const s = pasted.value.trim()
  return /^data:image\/[\w.+-]+;base64,/.test(s) ? s : ''
})
const showInvalid = computed(() => (pasted.value.trim().length > 0 && !previewSrc.value) || pastedBroken.value)
const decoded = computed(() => {
  if (!previewSrc.value) return null
  try {
    return dataUrlToBytes(previewSrc.value)
  } catch {
    return null
  }
})

watch(previewSrc, () => {
  pastedDims.value = null
  pastedBroken.value = false
})

function onPastedLoad(e: Event) {
  const img = e.target as HTMLImageElement
  pastedDims.value = { w: img.naturalWidth, h: img.naturalHeight }
}

function downloadPasted() {
  if (!previewSrc.value) return
  downloadUrl(previewSrc.value, `image.${extensionForMime(decoded.value?.mime ?? 'image/png')}`)
}
</script>

<template>
  <ToolShell>
    <div class="mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined" divided>
        <v-btn value="toBase64" prepend-icon="mdi-image-outline">{{ T('toBase64') }}</v-btn>
        <v-btn value="toImage" prepend-icon="mdi-code-tags">{{ T('toImage') }}</v-btn>
      </v-btn-toggle>
    </div>

    <template v-if="mode === 'toBase64'">
      <FileDrop accept="image/*" :hint="T('uploadHint')" :show-selected="false" @files="onFiles" />

      <v-alert v-if="readError" type="error" variant="tonal" density="compact" class="mt-4">{{ readError }}</v-alert>

      <template v-if="dataUri">
        <!-- File summary -->
        <v-card variant="tonal" rounded="lg" class="mt-4 pa-3">
          <div class="d-flex align-center ga-4">
            <img :src="dataUri" class="preview rounded" :alt="fileName" @load="onSourceLoad" />
            <div class="text-body-2 min-w-0">
              <div class="font-weight-medium text-truncate">{{ fileName }}</div>
              <div class="text-medium-emphasis tabular-nums">
                <template v-if="sourceDims">{{ sourceDims.w }} × {{ sourceDims.h }} · </template>{{ formatBytes(fileSize) }}
              </div>
              <div class="text-medium-emphasis">{{ T('byteSize') }}: {{ formatBytes(byteSize) }}</div>
            </div>
          </div>
        </v-card>

        <!-- Data URIs run to megabytes: fixed-height panels keep the page snappy. -->
        <OutputPanel
          class="mt-4"
          :value="dataUri"
          :label="T('dataUri')"
          :rows="4"
          :auto-grow="false"
          :filename="`${baseName}.datauri.txt`"
        />
        <OutputPanel
          class="mt-4"
          :value="cssSnippet"
          :label="T('cssSnippet')"
          :rows="3"
          :auto-grow="false"
          :filename="`${baseName}.css`"
          mime="text/css;charset=utf-8"
        />
        <OutputPanel
          class="mt-4"
          :value="imgSnippet"
          :label="T('imgSnippet')"
          :rows="3"
          :auto-grow="false"
          :filename="`${baseName}.html`"
          mime="text/html;charset=utf-8"
        />
      </template>
    </template>

    <template v-else>
      <v-textarea v-model="pasted" :label="T('pasteHint')" rows="5" clearable hide-details class="code-area" />
      <div class="d-flex flex-wrap align-center ga-2 mt-2">
        <PasteBtn @paste="pasted = $event" />
      </div>

      <v-alert v-if="showInvalid" type="error" variant="tonal" density="compact" class="mt-3">
        {{ T('errInvalid') }}
      </v-alert>

      <v-card v-if="previewSrc && !pastedBroken" variant="outlined" rounded="lg" class="mt-4 pa-4">
        <div class="text-subtitle-2 text-medium-emphasis mb-2">{{ T('preview') }}</div>
        <img
          :src="previewSrc"
          class="preview-large rounded mb-2"
          alt=""
          @load="onPastedLoad"
          @error="pastedBroken = true"
        />
        <div class="text-body-2 text-medium-emphasis tabular-nums">
          <template v-if="pastedDims">{{ T('dimensions') }}: {{ pastedDims.w }} × {{ pastedDims.h }}</template>
          <template v-if="pastedDims && decoded"> · </template>
          <template v-if="decoded">{{ formatBytes(decoded.bytes.length) }}</template>
        </div>
        <v-btn class="mt-3" color="primary" prepend-icon="mdi-download" @click="downloadPasted">
          {{ T('download') }}
        </v-btn>
      </v-card>
    </template>
  </ToolShell>
</template>

<style scoped>
.preview {
  max-width: 200px;
  max-height: 120px;
  display: block;
  flex: none;
  background: rgba(var(--v-border-color), 0.08);
}
.preview-large {
  max-width: 100%;
  max-height: 320px;
  display: block;
  background: rgba(var(--v-border-color), 0.08);
}
</style>
