<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { SOLID_COLORS, cycleIndex, grayRamp, isHexColor, textOnGray } from '@/lib/screenTest'

const { t } = useI18n()
const custom = ref('#ff8800')
const colors = computed<string[]>(() => [...SOLID_COLORS, isHexColor(custom.value) ? custom.value : '#ff8800'])
const open = ref(false)
const index = ref(0)
const overlay = ref<HTMLElement | null>(null)
const hintVisible = ref(true)
let hintTimer: ReturnType<typeof setTimeout> | undefined

const current = computed(() => colors.value[index.value] ?? '#000000')
const ramp = grayRamp(17)
const dark = grayRamp(33).filter((s) => s.level <= 40)

function showHint() {
  hintVisible.value = true
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => (hintVisible.value = false), 2500)
}
async function start(i = 0) {
  index.value = i
  open.value = true
  showHint()
  await nextTick()
  try {
    // Fullscreen is best-effort (unsupported on iPhone Safari); the fixed overlay works either way.
    await overlay.value?.requestFullscreen?.()
  } catch {
    // stay in the overlay
  }
}
function close() {
  open.value = false
  clearTimeout(hintTimer)
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
}
function step(d: number) {
  index.value = cycleIndex(index.value, d, colors.value.length)
  showHint()
}
function onKey(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') close()
  else if (['ArrowRight', 'ArrowDown', ' ', 'Enter', 'PageDown'].includes(e.key)) step(1)
  else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) step(-1)
  else return
  e.preventDefault()
}
function onFsChange() {
  // Esc in real fullscreen exits fullscreen without a keydown reaching us.
  if (open.value && !document.fullscreenElement && wasFullscreen) close()
  wasFullscreen = !!document.fullscreenElement
}
let wasFullscreen = false

watch(open, (o) => {
  if (o) {
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFsChange)
  } else {
    window.removeEventListener('keydown', onKey)
    document.removeEventListener('fullscreenchange', onFsChange)
    wasFullscreen = false
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('fullscreenchange', onFsChange)
  clearTimeout(hintTimer)
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
})
</script>

<template>
  <ToolShell max-width="900">
    <v-card variant="outlined" class="pa-4">
      <div class="text-subtitle-1 mb-2">{{ t('tools.screen-test.solid') }}</div>
      <div class="d-flex flex-wrap ga-2 align-center">
        <button
          v-for="(c, i) in colors"
          :key="i"
          type="button"
          class="chip rounded"
          :style="{ backgroundColor: c }"
          :title="c"
          :aria-label="c"
          @click="start(i)"
        />
        <input v-model="custom" type="color" class="custom-pick" :aria-label="t('tools.screen-test.custom')" :title="t('tools.screen-test.custom')" />
      </div>
      <v-btn color="primary" class="mt-3" prepend-icon="mdi-fullscreen" @click="start(0)">{{ t('tools.screen-test.start') }}</v-btn>
      <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.screen-test.help') }}</div>
    </v-card>

    <v-card variant="outlined" class="pa-4 mt-4">
      <div class="text-subtitle-1">{{ t('tools.screen-test.banding') }}</div>
      <div class="text-caption text-medium-emphasis mb-2">{{ t('tools.screen-test.bandingHelp') }}</div>
      <div class="strip rounded" style="background: linear-gradient(to right, #000, #fff)" />
      <div class="strip rounded mt-2" style="background: linear-gradient(to right, #000, #f00)" />
      <div class="strip rounded mt-2" style="background: linear-gradient(to right, #000, #0f0)" />
      <div class="strip rounded mt-2" style="background: linear-gradient(to right, #000, #00f)" />
    </v-card>

    <v-card variant="outlined" class="pa-4 mt-4">
      <div class="text-subtitle-1">{{ t('tools.screen-test.ramp') }}</div>
      <div class="text-caption text-medium-emphasis mb-2">{{ t('tools.screen-test.rampHelp') }}</div>
      <div class="ramp rounded">
        <div v-for="s in ramp" :key="s.level" class="step tabular-nums" :style="{ backgroundColor: s.hex, color: textOnGray(s.level) }">{{ s.level }}</div>
      </div>
      <div class="text-caption text-medium-emphasis mt-3 mb-1">{{ t('tools.screen-test.darkRamp') }}</div>
      <div class="ramp rounded">
        <div v-for="s in dark" :key="s.level" class="step tabular-nums" :style="{ backgroundColor: s.hex, color: textOnGray(s.level) }">{{ s.level }}</div>
      </div>
    </v-card>

    <v-alert type="info" variant="tonal" density="compact" class="mt-4">{{ t('tools.screen-test.limits') }}</v-alert>

    <Teleport to="body">
      <div
        v-if="open"
        ref="overlay"
        class="overlay"
        :style="{ backgroundColor: current }"
        role="dialog"
        aria-modal="true"
        :aria-label="t('tools.screen-test.title')"
        @click="step(1)"
        @pointermove="showHint"
      >
        <div v-show="hintVisible" class="hint">
          {{ index + 1 }} / {{ colors.length }} · {{ current }} — {{ t('tools.screen-test.overlayHint') }}
        </div>
        <button type="button" class="exit" :title="t('common.close')" :aria-label="t('common.close')" @click.stop="close">✕</button>
      </div>
    </Teleport>
  </ToolShell>
</template>

<style scoped>
.chip { width: 44px; height: 44px; border: 2px solid rgba(128, 128, 128, 0.6); cursor: pointer; padding: 0; }
.custom-pick { width: 44px; height: 44px; padding: 0; border: 0; background: none; cursor: pointer; }
.strip { height: 40px; }
.ramp { display: flex; overflow: hidden; border: 1px solid rgba(128, 128, 128, 0.4); }
.step { flex: 1 1 0; min-width: 0; height: 72px; display: flex; align-items: flex-end; justify-content: center; font-size: 10px; padding-bottom: 4px; }
.overlay { position: fixed; inset: 0; z-index: 3000; cursor: pointer; }
.hint { position: absolute; left: 12px; bottom: 12px; padding: 6px 10px; border-radius: 6px; background: rgba(0, 0, 0, 0.7); color: #fff; font-size: 13px; max-width: calc(100% - 80px); }
.exit { position: absolute; top: 12px; right: 12px; width: 40px; height: 40px; border-radius: 50%; border: 0; background: rgba(0, 0, 0, 0.7); color: #fff; font-size: 18px; cursor: pointer; }
</style>
