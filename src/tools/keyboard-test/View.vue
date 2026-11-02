<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import {
  MAIN_LAYOUT, NAV_LAYOUT, NUMPAD_LAYOUT, describeEvent, formatEvent, isGap, keyDisplay, layoutCodes, locationName,
  type KeyEventInfo, type LayoutItem,
} from '@/lib/keyboard'

const { t } = useI18n()
const MAX_LOG = 20
const active = ref(false)
const down = ref(new Set<string>())
const used = ref(new Set<string>())
const last = ref<KeyEventInfo | null>(null)
const log = ref<KeyEventInfo[]>([])
const total = layoutCodes().length
const usedCount = computed(() => layoutCodes().filter((c) => used.value.has(c)).length)

function record(e: KeyboardEvent) {
  // Only swallow browser shortcuts while this area has focus.
  e.preventDefault()
  const info = describeEvent(e)
  last.value = info
  log.value = [info, ...log.value].slice(0, MAX_LOG)
  const code = e.code || e.key
  const d = new Set(down.value)
  if (e.type === 'keydown') {
    d.add(code)
    used.value = new Set(used.value).add(code)
  } else {
    d.delete(code)
  }
  down.value = d
}
function onBlur() {
  active.value = false
  down.value = new Set()
}
function reset() {
  down.value = new Set()
  used.value = new Set()
  last.value = null
  log.value = []
}
function keyStyle(i: LayoutItem) {
  return { width: `calc(var(--u) * ${isGap(i) ? i.gap : i.w})` }
}
const blocks = [MAIN_LAYOUT, NAV_LAYOUT, NUMPAD_LAYOUT]
const logText = computed(() => log.value.map(formatEvent).join('\n'))
</script>

<template>
  <ToolShell>
    <div
      class="kb-area rounded-lg pa-3"
      :class="{ active }"
      tabindex="0"
      role="application"
      :aria-label="t('tools.keyboard-test.area')"
      @focus="active = true"
      @blur="onBlur"
      @keydown="record"
      @keyup="record"
    >
      <div class="text-body-2 mb-2" :class="active ? 'text-success' : 'text-medium-emphasis'">
        {{ active ? t('tools.keyboard-test.listening') : t('tools.keyboard-test.clickToStart') }}
      </div>
      <div class="kb-blocks">
        <div v-for="(block, bi) in blocks" :key="bi" class="kb-block">
          <div v-for="(row, ri) in block" :key="ri" class="kb-row">
            <template v-for="(item, ii) in row" :key="ii">
              <span v-if="isGap(item)" class="kb-gap" :style="keyStyle(item)" />
              <span
                v-else
                class="kb-key"
                :class="{ down: down.has(item.code), used: used.has(item.code) && !down.has(item.code) }"
                :style="keyStyle(item)"
              >{{ item.label }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="d-flex align-center flex-wrap ga-3 mt-3">
      <v-chip label size="small">{{ t('tools.keyboard-test.tested', { n: usedCount, total }) }}</v-chip>
      <v-spacer />
      <v-btn variant="tonal" prepend-icon="mdi-restore" @click="reset">{{ t('common.reset') }}</v-btn>
    </div>
    <div class="text-caption text-medium-emphasis mt-1">{{ t('tools.keyboard-test.legend') }}</div>

    <v-card variant="tonal" class="mt-4 pa-4">
      <v-row density="comfortable">
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">key</div>
          <div class="font-mono tabular-nums break-all">{{ last ? keyDisplay(last.key) : '—' }}</div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">code</div>
          <div class="font-mono break-all">{{ last?.code ?? '—' }}</div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">location</div>
          <div class="font-mono">{{ last ? `${last.location} (${locationName(last.location)})` : '—' }}</div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="text-caption text-medium-emphasis">keyCode ({{ t('tools.keyboard-test.legacy') }})</div>
          <div class="font-mono tabular-nums">{{ last?.keyCode ?? '—' }}</div>
        </v-col>
      </v-row>
    </v-card>

    <div class="d-flex align-center mt-4">
      <div class="text-subtitle-2">{{ t('tools.keyboard-test.log', { n: MAX_LOG }) }}</div>
      <v-spacer />
      <CopyBtn :text="logText" size="small" />
    </div>
    <v-table density="compact" class="border rounded mt-1 log-table">
      <thead>
        <tr><th>type</th><th>key</th><th>code</th><th>loc</th><th>keyCode</th></tr>
      </thead>
      <tbody class="font-mono">
        <tr v-if="!log.length"><td colspan="5" class="text-medium-emphasis">{{ t('tools.keyboard-test.empty') }}</td></tr>
        <tr v-for="(e, i) in log" :key="i">
          <td>{{ e.type.replace('key', '') }}{{ e.repeat ? ' ↻' : '' }}</td>
          <td>{{ keyDisplay(e.key) }}</td>
          <td>{{ e.code }}</td>
          <td>{{ e.location }}</td>
          <td class="tabular-nums">{{ e.keyCode }}</td>
        </tr>
      </tbody>
    </v-table>
    <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.keyboard-test.limits') }}</div>
  </ToolShell>
</template>

<style scoped>
.kb-area { --u: min(44px, calc((100vw - 64px) / 15)); border: 2px dashed rgba(128, 128, 128, 0.5); outline: none; overflow: hidden; }
.kb-area.active { border-style: solid; border-color: rgb(var(--v-theme-success)); }
.kb-blocks { display: flex; flex-wrap: wrap; gap: calc(var(--u) * 0.5); }
.kb-block { display: flex; flex-direction: column; }
.kb-block:first-child { gap: 0; }
.kb-row { display: flex; }
.kb-gap { display: block; height: var(--u); }
.kb-key {
  display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  height: var(--u); margin: 0 1px 2px 0; border: 1px solid rgba(128, 128, 128, 0.5); border-radius: 4px;
  font-size: clamp(8px, calc(var(--u) * 0.32), 13px); user-select: none; overflow: hidden;
}
.kb-key.used { background: rgba(var(--v-theme-success), 0.35); }
.kb-key.down { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
.log-table { max-height: 320px; overflow-y: auto; }
</style>
