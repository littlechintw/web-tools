<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import FileDrop from '@/components/FileDrop.vue'

const { t } = useI18n()

type Mode = 'toBase64' | 'toImage'
const mode = ref<Mode>('toBase64')

// Mode A
const dataUri = ref('')
const fileName = ref('')

// Mode B
const pasted = ref('')

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const byteSize = computed(() => new TextEncoder().encode(dataUri.value).length)

const cssSnippet = computed(() =>
  dataUri.value ? `background-image: url("${dataUri.value}");` : '',
)
const imgSnippet = computed(() => (dataUri.value ? `<img src="${dataUri.value}" alt="" />` : ''))

function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  fileName.value = file.name
  const fr = new FileReader()
  fr.onload = () => {
    dataUri.value = typeof fr.result === 'string' ? fr.result : ''
  }
  fr.readAsDataURL(file)
}

const isValidDataUri = computed(() => /^data:image\/[\w.+-]+;base64,/.test(pasted.value.trim()))

const previewSrc = computed(() => (isValidDataUri.value ? pasted.value.trim() : ''))
const showInvalid = computed(() => pasted.value.trim().length > 0 && !isValidDataUri.value)

function downloadPasted() {
  const src = previewSrc.value
  if (!src) return
  const mime = src.slice(5, src.indexOf(';'))
  const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')
  const a = document.createElement('a')
  a.href = src
  a.download = `image.${ext}`
  a.click()
}
</script>

<template>
  <ToolShell>
    <div class="mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="toBase64">{{ t('tools.image-base64.toBase64') }}</v-btn>
        <v-btn value="toImage">{{ t('tools.image-base64.toImage') }}</v-btn>
      </v-btn-toggle>
    </div>

    <template v-if="mode === 'toBase64'">
      <FileDrop accept="image/*" :hint="t('tools.image-base64.uploadHint')" @files="onFiles" />

      <template v-if="dataUri">
        <div class="d-flex align-center ga-4 mt-3">
          <img :src="dataUri" class="preview rounded" :alt="fileName" />
          <div class="text-body-2">
            <div v-if="fileName">{{ fileName }}</div>
            <div>{{ t('tools.image-base64.byteSize') }}: {{ formatBytes(byteSize) }}</div>
          </div>
        </div>

        <v-textarea
          :model-value="dataUri"
          :label="t('tools.image-base64.dataUri')"
          rows="4"
          auto-grow
          readonly
          class="code-area mt-3"
        />
        <div class="d-flex ga-2 mt-1">
          <CopyBtn :text="dataUri" />
        </div>

        <v-textarea
          :model-value="cssSnippet"
          :label="t('tools.image-base64.cssSnippet')"
          rows="2"
          auto-grow
          readonly
          class="code-area mt-3"
        />
        <div class="d-flex ga-2 mt-1">
          <CopyBtn :text="cssSnippet" />
        </div>

        <v-textarea
          :model-value="imgSnippet"
          :label="t('tools.image-base64.imgSnippet')"
          rows="2"
          auto-grow
          readonly
          class="code-area mt-3"
        />
        <div class="d-flex ga-2 mt-1">
          <CopyBtn :text="imgSnippet" />
        </div>
      </template>
    </template>

    <template v-else>
      <v-textarea
        v-model="pasted"
        :label="t('tools.image-base64.pasteHint')"
        rows="5"
        auto-grow
        clearable
        class="code-area"
      />
      <v-alert v-if="showInvalid" type="error" variant="tonal" class="mt-2">
        {{ t('tools.image-base64.errInvalid') }}
      </v-alert>

      <template v-if="previewSrc">
        <div class="text-subtitle-2 mt-3 mb-1">{{ t('tools.image-base64.preview') }}</div>
        <img :src="previewSrc" class="preview rounded mb-2" alt="" />
        <div>
          <v-btn color="primary" prepend-icon="mdi-download" @click="downloadPasted">
            {{ t('tools.image-base64.download') }}
          </v-btn>
        </div>
      </template>
    </template>
  </ToolShell>
</template>

<style scoped>
.preview {
  max-width: 100%;
  max-height: 200px;
  display: block;
  background: rgba(var(--v-border-color), 0.08);
}
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
</style>
