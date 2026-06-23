<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import FileDrop from '@/components/FileDrop.vue'

const { t } = useI18n()

type Mode = 'camera' | 'image'
const mode = ref<Mode>('camera')
const result = ref('')
const error = ref('')
const scanning = ref(false)

const videoEl = ref<HTMLVideoElement | null>(null)
const reader = new BrowserMultiFormatReader()
let controls: IScannerControls | null = null
let objectUrl: string | null = null

const isUrl = computed(() => /^https?:\/\//i.test(result.value.trim()))

function revokeUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

function stopCamera() {
  if (controls) {
    controls.stop()
    controls = null
  }
  scanning.value = false
}

async function startCamera() {
  error.value = ''
  result.value = ''
  if (!videoEl.value) return
  try {
    scanning.value = true
    controls = await reader.decodeFromVideoDevice(undefined, videoEl.value, (res, err) => {
      if (res) {
        result.value = res.getText()
        stopCamera()
      }
      // Per-frame "not found" errors are expected; ignore them.
      void err
    })
  } catch (e) {
    scanning.value = false
    const name = (e as { name?: string })?.name
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      error.value = t('tools.qr-scan.errPermission')
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      error.value = t('tools.qr-scan.errNoCamera')
    } else {
      error.value = t('tools.qr-scan.errPermission')
    }
  }
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  stopCamera()
  error.value = ''
  result.value = ''
  revokeUrl()
  objectUrl = URL.createObjectURL(file)
  try {
    const res = await reader.decodeFromImageUrl(objectUrl)
    result.value = res.getText()
  } catch {
    error.value = t('tools.qr-scan.errDecode')
  }
}

function switchMode(m: Mode) {
  if (m === mode.value) return
  stopCamera()
  mode.value = m
}

onUnmounted(() => {
  stopCamera()
  revokeUrl()
})
</script>

<template>
  <ToolShell>
    <div class="mb-4">
      <v-btn-toggle
        :model-value="mode"
        mandatory
        color="primary"
        density="comfortable"
        variant="outlined"
        @update:model-value="switchMode"
      >
        <v-btn value="camera">{{ t('tools.qr-scan.camera') }}</v-btn>
        <v-btn value="image">{{ t('tools.qr-scan.image') }}</v-btn>
      </v-btn-toggle>
    </div>

    <template v-if="mode === 'camera'">
      <div class="video-wrap rounded-lg mb-3">
        <video ref="videoEl" class="video-el" muted playsinline />
      </div>
      <div class="d-flex ga-2 mb-2">
        <v-btn v-if="!scanning" color="primary" prepend-icon="mdi-camera" @click="startCamera">
          {{ t('tools.qr-scan.start') }}
        </v-btn>
        <v-btn v-else color="error" variant="tonal" prepend-icon="mdi-stop" @click="stopCamera">
          {{ t('tools.qr-scan.stop') }}
        </v-btn>
        <span v-if="scanning" class="text-medium-emphasis align-self-center">
          {{ t('tools.qr-scan.scanning') }}
        </span>
      </div>
    </template>

    <template v-else>
      <FileDrop accept="image/*" :hint="t('tools.qr-scan.uploadHint')" @files="onFiles" />
    </template>

    <v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{ error }}</v-alert>

    <v-card v-if="result" variant="tonal" class="mt-4">
      <v-card-title class="text-subtitle-2">{{ t('tools.qr-scan.result') }}</v-card-title>
      <v-card-text>
        <div class="result-text mb-3">{{ result }}</div>
        <div class="d-flex flex-wrap ga-2">
          <CopyBtn :text="result" />
          <v-btn
            v-if="isUrl"
            color="primary"
            variant="text"
            prepend-icon="mdi-open-in-new"
            :href="result"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('tools.qr-scan.open') }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <p v-if="!result && !error" class="text-medium-emphasis mt-3">
      {{ t('tools.qr-scan.noResult') }}
    </p>
  </ToolShell>
</template>

<style scoped>
.video-wrap {
  background: #000;
  aspect-ratio: 4 / 3;
  max-width: 480px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.video-el {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.result-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
