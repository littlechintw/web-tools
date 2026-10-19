<script setup lang="ts">
import { computed, ref, shallowReactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { isBoolean, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { downloadBlob } from '@/utils/download'
import {
  IMAGE_LADDER,
  PRESETS,
  PRESET_IDS,
  RASTER_LADDER,
  CancelledError,
  PdfPasswordError,
  analyzePdf,
  compressPdfImages,
  formatBytes,
  searchLadder,
  type CompressProgress,
  type CompressStats,
  type ImageSettings,
  type PassResult,
  type PdfAnalysis,
  type PresetId,
  type RasterSettings,
} from '@/lib/pdfCompress'
import { canvasJpegEncoder, rasterizePdf } from '@/lib/pdfCompressBrowser'

const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.pdf-compress.${key}`, args ?? {})

type Mode = 'preset' | 'target'
const UNITS = ['MB', 'KB'] as const
type Unit = (typeof UNITS)[number]

interface Result {
  blob: Blob
  size: number
  rasterized: boolean
  /** Human-readable settings that produced this result. */
  detail: string
  stats?: CompressStats
  /** Target mode only. */
  target?: number
  fits?: boolean
}

const PRESET_LABEL: Record<PresetId, string> = {
  light: 'presetLight',
  medium: 'presetMedium',
  strong: 'presetStrong',
}

// The source bytes are large and never change after load; keep them out of
// Vue's reactivity.
let originalBytes: Uint8Array | null = null
const fileName = ref('')
const originalSize = ref(0)
const analysis = ref<PdfAnalysis | null>(null)
const analyzing = ref(false)
const password = ref('')
const needsPassword = ref(false)

// Preferences are remembered between visits; the mode and the lossy
// "rasterize" switch are deliberately not, so a fresh visit starts safe.
const mode = ref<Mode>('preset')
const preset = useStoredRef<PresetId>('pdf-compress.preset', 'medium', oneOf(PRESET_IDS))
const rasterize = ref(false)
const rasterFallback = useStoredRef('pdf-compress.rasterFallback', false, isBoolean)
const stripMeta = useStoredRef('pdf-compress.stripMeta', true, isBoolean)
const targetValue = ref(2)
const targetUnit = useStoredRef<Unit>('pdf-compress.targetUnit', 'MB', oneOf(UNITS))

const busy = ref(false)
const progress = ref<{ text: string; value: number | null }>({ text: '', value: null })
const error = ref('')
const result = shallowRef<Result | null>(null)

// Results per preset for the current file + options, so switching presets
// after "estimate all" is instant and each card can show the size it reaches.
const cache = shallowReactive(new Map<string, Result>())
let attemptText = ''

const targetBytes = computed(() => {
  const v = Number(targetValue.value)
  if (!Number.isFinite(v) || v <= 0) return 0
  return Math.round(v * (targetUnit.value === 'MB' ? 1024 * 1024 : 1024))
})

const reduction = computed(() =>
  result.value && originalSize.value ? Math.round((1 - result.value.size / originalSize.value) * 100) : 0,
)

const cacheKey = (id: PresetId) => `${id}|${rasterize.value ? 'r' : 'i'}|${stripMeta.value ? 'm' : '-'}`
const presetSizes = computed(() =>
  Object.fromEntries(PRESET_IDS.map((id) => [id, cache.get(cacheKey(id))?.size])) as Partial<
    Record<PresetId, number>
  >,
)

function settingsText(s: ImageSettings | RasterSettings, raster: boolean): string {
  return raster
    ? T('rasterDetail', { dpi: (s as RasterSettings).dpi, quality: Math.round(s.quality * 100) })
    : T('imageDetail', { quality: Math.round(s.quality * 100), edge: (s as ImageSettings).maxEdge })
}

function resetAll() {
  cache.clear()
  result.value = null
  analysis.value = null
  error.value = ''
  needsPassword.value = false
  password.value = ''
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    error.value = T('notPdf')
    return
  }
  resetAll()
  fileName.value = file.name.replace(/\.pdf$/i, '')
  originalSize.value = file.size
  originalBytes = new Uint8Array(await file.arrayBuffer())
  await analyze()
}

async function analyze() {
  if (!originalBytes) return
  analyzing.value = true
  error.value = ''
  try {
    analysis.value = await analyzePdf(originalBytes, password.value || undefined)
    needsPassword.value = false
  } catch (e) {
    if (e instanceof PdfPasswordError) {
      if (needsPassword.value) error.value = T('wrongPassword')
      needsPassword.value = true
    } else {
      error.value = T('loadFailed', { msg: (e as Error).message })
    }
  } finally {
    analyzing.value = false
  }
}

function onProgress(p: CompressProgress) {
  const phase =
    p.phase === 'saving'
      ? T('progressSaving')
      : T(p.phase === 'images' ? 'progressImages' : 'progressPages', {
          done: Math.min(p.done + 1, p.total),
          total: p.total,
        })
  progress.value = {
    text: attemptText ? `${attemptText} · ${phase}` : phase,
    value: p.total ? Math.round((p.done / p.total) * 100) : null,
  }
}

// One controller per run so the cancel button can stop a multi-pass search.
let controller: AbortController | null = null

function cancel() {
  controller?.abort()
}

function runImage(s: ImageSettings): Promise<PassResult> {
  return compressPdfImages(
    originalBytes!,
    { ...s, stripMetadata: stripMeta.value, password: password.value || undefined, signal: controller?.signal },
    canvasJpegEncoder,
    onProgress,
  )
}

async function runRaster(s: RasterSettings): Promise<PassResult> {
  const bytes = await rasterizePdf(
    originalBytes!,
    { ...s, password: password.value || undefined, signal: controller?.signal },
    onProgress,
  )
  return { bytes }
}

function makeResult(pass: PassResult, rasterized: boolean, detail: string, extra: Partial<Result> = {}): Result {
  const blob = new Blob([pass.bytes as BlobPart], { type: 'application/pdf' })
  return { blob, size: blob.size, rasterized, detail, stats: pass.stats, ...extra }
}

async function compressPreset(id: PresetId): Promise<Result> {
  const key = cacheKey(id)
  const hit = cache.get(key)
  if (hit) return hit
  const s = PRESETS[id]
  const raster = rasterize.value
  const pass = raster ? await runRaster(s.raster) : await runImage(s.image)
  const r = makeResult(pass, raster, settingsText(raster ? s.raster : s.image, raster))
  cache.set(key, r)
  return r
}

async function compressTarget(): Promise<Result> {
  const target = targetBytes.value
  if (!target) throw new Error(T('invalidTarget'))
  let attempt = 0
  const label = (s: ImageSettings | RasterSettings, raster: boolean) => {
    attempt++
    attemptText = T('progressAttempt', { n: attempt, detail: settingsText(s, raster) })
  }

  // Already small enough: a single gentle pass is all that's needed.
  if (originalSize.value <= target) {
    const s = IMAGE_LADDER[0]
    label(s, false)
    const pass = await runImage(s)
    return makeResult(pass, false, settingsText(s, false), { target, fits: pass.bytes.length <= target })
  }

  const r1 = await searchLadder(IMAGE_LADDER, target, (s) => {
    label(s, false)
    return runImage(s)
  })
  if (r1.fits || !rasterFallback.value) {
    return makeResult(r1, false, settingsText(r1.step, false), { target, fits: r1.fits })
  }

  const r2 = await searchLadder(RASTER_LADDER, target, (s) => {
    label(s, true)
    return runRaster(s)
  })
  if (r2.fits || r2.bytes.length < r1.bytes.length) {
    return makeResult(r2, true, settingsText(r2.step, true), { target, fits: r2.fits })
  }
  return makeResult(r1, false, settingsText(r1.step, false), { target, fits: false })
}

async function compress() {
  if (!originalBytes || busy.value) return
  busy.value = true
  error.value = ''
  attemptText = ''
  controller = new AbortController()
  progress.value = { text: '', value: null }
  try {
    result.value = mode.value === 'preset' ? await compressPreset(preset.value) : await compressTarget()
  } catch (e) {
    if (!(e instanceof CancelledError)) error.value = (e as Error).message
  } finally {
    controller = null
    busy.value = false
    attemptText = ''
  }
}

/** Run every preset so each card shows how small it gets. */
async function estimateAll() {
  if (!originalBytes || busy.value) return
  busy.value = true
  error.value = ''
  controller = new AbortController()
  try {
    for (const id of PRESET_IDS) {
      attemptText = T(PRESET_LABEL[id])
      await compressPreset(id)
    }
    result.value = cache.get(cacheKey(preset.value)) ?? null
  } catch (e) {
    if (!(e instanceof CancelledError)) error.value = (e as Error).message
  } finally {
    controller = null
    busy.value = false
    attemptText = ''
  }
}

function download() {
  if (!result.value) return
  downloadBlob(result.value.blob, `${fileName.value || 'compressed'}-compressed.pdf`)
}
</script>

<template>
  <ToolShell>
    <FileDrop accept="application/pdf,.pdf" :show-selected="false" :hint="T('dropHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <!-- Password prompt for protected files -->
    <v-card v-if="needsPassword" variant="tonal" color="warning" rounded="lg" class="mt-4 pa-4">
      <div class="text-body-2 mb-3">{{ T('encrypted') }}</div>
      <div class="d-flex ga-2 align-center">
        <v-text-field
          v-model="password"
          :label="T('password')"
          type="password"
          density="comfortable"
          hide-details
          autocomplete="off"
          @keydown.enter="analyze"
        />
        <v-btn color="primary" :loading="analyzing" @click="analyze">{{ T('unlock') }}</v-btn>
      </div>
    </v-card>

    <div v-else-if="analyzing" class="d-flex align-center ga-3 mt-6 text-medium-emphasis">
      <v-progress-circular indeterminate size="20" width="2" />
      {{ t('common.loading') }}
    </div>

    <p v-else-if="!analysis" class="text-medium-emphasis text-body-2 mt-6">
      {{ T('noPdf') }}
    </p>

    <template v-if="analysis">
      <!-- File summary -->
      <v-card variant="tonal" rounded="lg" class="mt-4 pa-4">
        <div class="d-flex align-center ga-3 flex-wrap">
          <v-icon icon="mdi-file-pdf-box" size="28" color="primary" />
          <div class="flex-grow-1 text-truncate">
            <div class="text-subtitle-1 font-weight-medium text-truncate">{{ fileName }}.pdf</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ formatBytes(originalSize) }} · {{ T('pages', { count: analysis.pageCount }) }}
            </div>
          </div>
        </div>
        <div class="text-body-2 mt-3">
          <template v-if="analysis.candidateCount > 0">
            {{
              T('imageInfo', {
                count: analysis.imageCount,
                size: formatBytes(analysis.imageBytes),
                candidates: analysis.candidateCount,
                candidateSize: formatBytes(analysis.candidateBytes),
              })
            }}
          </template>
          <span v-else class="text-medium-emphasis">{{ T('noImages') }}</span>
        </div>
        <div v-if="analysis.encrypted" class="text-caption text-warning mt-2">
          <v-icon icon="mdi-lock-open-variant-outline" size="14" class="mr-1" />{{ T('encryptedNote') }}
        </div>
      </v-card>

      <!-- Mode -->
      <div class="text-subtitle-2 mt-6 mb-2">{{ T('mode') }}</div>
      <v-btn-toggle v-model="mode" mandatory color="primary" variant="outlined" density="comfortable" divided>
        <v-btn value="preset" prepend-icon="mdi-tune">{{ T('modePreset') }}</v-btn>
        <v-btn value="target" prepend-icon="mdi-bullseye-arrow">{{ T('modeTarget') }}</v-btn>
      </v-btn-toggle>

      <!-- Preset mode -->
      <template v-if="mode === 'preset'">
        <v-row density="comfortable" class="mt-3" role="radiogroup">
          <v-col v-for="id in PRESET_IDS" :key="id" cols="12" sm="4">
            <v-card
              :variant="preset === id ? 'tonal' : 'outlined'"
              :color="preset === id ? 'primary' : undefined"
              rounded="lg"
              class="pa-3 h-100 preset-card"
              role="radio"
              :aria-checked="preset === id"
              tabindex="0"
              @click="preset = id"
              @keydown.enter.prevent="preset = id"
              @keydown.space.prevent="preset = id"
            >
              <div class="d-flex align-center justify-space-between ga-2">
                <span class="text-subtitle-2 font-weight-medium">{{ T(PRESET_LABEL[id]) }}</span>
                <v-chip v-if="presetSizes[id] !== undefined" size="x-small" label color="primary" variant="flat">
                  {{ T('about', { size: formatBytes(presetSizes[id]!) }) }}
                </v-chip>
              </div>
              <div class="text-caption text-medium-emphasis mt-1">
                {{ settingsText(rasterize ? PRESETS[id].raster : PRESETS[id].image, rasterize) }}
              </div>
            </v-card>
          </v-col>
        </v-row>

        <v-switch
          v-model="rasterize"
          :label="T('rasterize')"
          color="primary"
          density="comfortable"
          hide-details
          class="mt-2"
        />
        <p class="text-caption text-medium-emphasis ml-1 mb-0">{{ T('rasterizeHint') }}</p>
      </template>

      <!-- Target mode -->
      <template v-else>
        <v-row density="comfortable" class="mt-3" align="center">
          <v-col cols="8" sm="4">
            <v-text-field
              v-model.number="targetValue"
              :label="T('target')"
              type="number"
              min="0.1"
              step="0.1"
              density="comfortable"
              hide-details
            />
          </v-col>
          <v-col cols="4" sm="2">
            <v-select v-model="targetUnit" :items="UNITS" density="comfortable" hide-details />
          </v-col>
        </v-row>
        <p class="text-caption text-medium-emphasis ml-1 mt-2 mb-0">{{ T('targetHint') }}</p>
        <v-checkbox
          v-model="rasterFallback"
          :label="T('rasterFallback')"
          color="primary"
          density="compact"
          hide-details
          class="mt-1"
        />
        <p class="text-caption text-medium-emphasis ml-1 mb-0">{{ T('rasterizeHint') }}</p>
      </template>

      <v-checkbox v-model="stripMeta" :label="T('stripMeta')" color="primary" density="compact" hide-details class="mt-3" />
      <p class="text-caption text-medium-emphasis ml-1 mb-0">{{ T('stripMetaHint') }}</p>

      <!-- Actions -->
      <div class="d-flex flex-wrap ga-2 mt-6">
        <v-btn
          color="primary"
          size="large"
          :loading="busy"
          :disabled="mode === 'target' && !targetBytes"
          prepend-icon="mdi-zip-box-outline"
          @click="compress"
        >
          {{ busy ? T('compressing') : T('compress') }}
        </v-btn>
        <v-btn
          v-if="mode === 'preset'"
          variant="text"
          size="large"
          :disabled="busy"
          prepend-icon="mdi-calculator-variant-outline"
          @click="estimateAll"
        >
          {{ T('estimateAll') }}
        </v-btn>
      </div>

      <!-- Progress -->
      <div v-if="busy" class="mt-4">
        <v-progress-linear
          :model-value="progress.value ?? 0"
          :indeterminate="progress.value === null"
          color="primary"
          rounded
          height="6"
        />
        <div class="d-flex align-center ga-2 mt-2">
          <span class="text-caption text-medium-emphasis">{{ progress.text }}</span>
          <v-spacer />
          <v-btn size="small" variant="text" prepend-icon="mdi-close" @click="cancel">{{ t('common.cancel') }}</v-btn>
        </div>
      </div>

      <!-- Result -->
      <v-card v-if="result && !busy" variant="outlined" rounded="lg" class="mt-6 pa-4">
        <div class="text-subtitle-2 text-medium-emphasis mb-2">{{ T('resultTitle') }}</div>
        <div class="d-flex align-center flex-wrap ga-3">
          <span class="text-h6 text-medium-emphasis text-decoration-line-through">{{ formatBytes(originalSize) }}</span>
          <v-icon icon="mdi-arrow-right" size="20" class="text-medium-emphasis" />
          <span class="text-h4 font-weight-bold" :class="reduction > 0 ? 'text-success' : 'text-error'">
            {{ formatBytes(result.size) }}
          </span>
          <v-chip :color="reduction > 0 ? 'success' : 'error'" variant="flat" size="small" label>
            {{ reduction >= 0 ? T('reduced', { percent: reduction }) : T('increased', { percent: -reduction }) }}
          </v-chip>
        </div>

        <div class="text-caption text-medium-emphasis mt-3">
          {{ T('usedSettings', { detail: result.detail }) }}
          <template v-if="result.stats">
            · {{ T('stats', { images: result.stats.imagesRecompressed, objects: result.stats.objectsRemoved }) }}
          </template>
        </div>

        <v-alert v-if="result.target !== undefined && result.fits" type="success" variant="tonal" density="compact" class="mt-3">
          {{ T('targetMet', { target: formatBytes(result.target) }) }}
        </v-alert>
        <v-alert v-else-if="result.target !== undefined" type="warning" variant="tonal" density="compact" class="mt-3">
          {{ T('targetMissed', { target: formatBytes(result.target), size: formatBytes(result.size) }) }}
          <template v-if="!rasterFallback"> {{ T('targetMissedHint') }}</template>
        </v-alert>
        <v-alert v-else-if="reduction <= 0" type="info" variant="tonal" density="compact" class="mt-3">
          {{ T('resultLarger') }}
        </v-alert>

        <v-btn
          class="mt-4"
          color="primary"
          :disabled="reduction <= 0 && result.target === undefined"
          prepend-icon="mdi-download"
          @click="download"
        >
          {{ T('download') }}
        </v-btn>
      </v-card>
    </template>
  </ToolShell>
</template>

<style scoped>
.preset-card {
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.preset-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
