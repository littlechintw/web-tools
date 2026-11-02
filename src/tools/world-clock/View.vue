<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useStoredRef } from '@/composables/useStoredRef'
import {
  allZones, buildTimeline, cityLabel, formatClock, formatDate, formatOffset, isValidZone, localZone, overlapWindows,
  regionLabel, viewInZone, zonedTimeToInstant,
} from '@/lib/world-clock'

const { t } = useI18n()

const local = localZone()
const DEFAULTS = ['Asia/Taipei', 'Asia/Tokyo', 'Europe/London', 'America/New_York']
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 40 && v.every((x) => typeof x === 'string')
const stored = useStoredRef<string[]>('world-clock.zones', DEFAULTS, isStringArray)

/** Own zone first (cannot be removed), then the saved ones. */
const zones = computed(() => [local, ...stored.value.filter((z) => z !== local && isValidZone(z))].filter((z, i, a) => a.indexOf(z) === i))

const zoneItems = allZones().map((z) => ({ title: `${cityLabel(z)}${regionLabel(z) ? ' · ' + regionLabel(z) : ''}`, value: z }))
const search = ref<string | null>(null)
function addZone(z: string | null) {
  if (z && isValidZone(z) && !zones.value.includes(z) && stored.value.length < 30) stored.value = [...stored.value, z]
  search.value = null
}
const removeZone = (z: string) => (stored.value = stored.value.filter((x) => x !== z))

// Ticking clock
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => clearInterval(timer))

const rows = computed(() =>
  zones.value.map((z) => ({ zone: z, v: viewInZone(now.value, z, local) })),
)
const dayLabel = (diff: number) => (diff === 0 ? t('tools.world-clock.sameDay') : diff > 0 ? t('tools.world-clock.nextDay') : t('tools.world-clock.prevDay'))

// Meeting planner
const pad = (n: number) => String(n).padStart(2, '0')
const d0 = new Date()
const date = ref(`${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`)
const time = ref('10:00')
const baseZone = ref(local)
const base = computed(() => (zones.value.includes(baseZone.value) ? baseZone.value : local))

const parsed = computed(() => {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.value)
  const tm = /^(\d{2}):(\d{2})$/.exec(time.value)
  return dm && tm ? { y: +dm[1], m: +dm[2], d: +dm[3], hh: +tm[1], mm: +tm[2] } : null
})
const instant = computed(() => (parsed.value ? zonedTimeToInstant(parsed.value.y, parsed.value.m, parsed.value.d, parsed.value.hh, parsed.value.mm, base.value) : null))
const meeting = computed(() =>
  instant.value
    ? zones.value.map((z) => {
        const v = viewInZone(instant.value!, z, base.value)
        const mins = v.wall.hh * 60 + v.wall.mm
        return { zone: z, v, working: mins >= 9 * 60 && mins < 18 * 60 }
      })
    : [],
)
const timeline = computed(() => (parsed.value ? buildTimeline(parsed.value, base.value, zones.value) : []))
const windows = computed(() => overlapWindows(timeline.value))
const selectedHour = computed(() => parsed.value?.hh ?? -1)
const windowText = computed(() => windows.value.map(([a, b]) => `${pad(a)}:00–${pad(b)}:00`).join(', '))

const meetingText = computed(() =>
  meeting.value.map((m) => `${cityLabel(m.zone)}: ${formatDate(m.v.wall)} ${formatClock(m.v.wall)} (${formatOffset(m.v.offset)})`).join('\n'),
)
const baseItems = computed(() => zones.value.map((z) => ({ title: cityLabel(z), value: z })))
</script>

<template>
  <ToolShell max-width="1000">
    <v-autocomplete
      :model-value="search"
      :items="zoneItems"
      :label="t('tools.world-clock.addZone')"
      :no-data-text="t('tools.world-clock.noMatch')"
      prepend-inner-icon="mdi-magnify"
      clearable
      hide-details
      auto-select-first
      @update:model-value="addZone"
    />

    <v-list class="border rounded mt-4 py-0">
      <v-list-item v-for="r in rows" :key="r.zone" class="px-3">
        <div class="d-flex align-center ga-3">
          <div class="flex-grow-1 overflow-hidden">
            <div class="font-weight-medium text-truncate">
              {{ cityLabel(r.zone) }}
              <v-chip v-if="r.zone === local" size="x-small" class="ml-1">{{ t('tools.world-clock.you') }}</v-chip>
            </div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ formatOffset(r.v.offset) }} · {{ regionLabel(r.zone) || r.zone }} · {{ formatDate(r.v.wall) }}
              <template v-if="r.v.dayDiff !== 0">({{ dayLabel(r.v.dayDiff) }})</template>
            </div>
          </div>
          <div class="text-h5 font-mono tabular-nums">{{ formatClock(r.v.wall, true) }}</div>
          <v-btn
            v-if="r.zone !== local"
            icon="mdi-close"
            size="small"
            variant="text"
            :title="t('tools.world-clock.remove')"
            :aria-label="t('tools.world-clock.remove')"
            @click="removeZone(r.zone)"
          />
          <span v-else style="width: 40px" />
        </div>
      </v-list-item>
    </v-list>

    <div class="text-subtitle-1 mt-6 mb-2">{{ t('tools.world-clock.planner') }}</div>
    <v-row density="comfortable">
      <v-col cols="12" sm="4">
        <v-text-field v-model="date" type="date" :label="t('tools.world-clock.date')" hide-details />
      </v-col>
      <v-col cols="6" sm="3">
        <v-text-field v-model="time" type="time" :label="t('tools.world-clock.time')" hide-details />
      </v-col>
      <v-col cols="6" sm="5">
        <v-select v-model="baseZone" :items="baseItems" :label="t('tools.world-clock.inZone')" hide-details />
      </v-col>
    </v-row>

    <v-alert v-if="!instant" type="info" variant="tonal" density="compact" class="mt-3">{{ t('tools.world-clock.invalid') }}</v-alert>
    <template v-else>
      <div class="overflow-x-auto mt-3">
        <v-table density="compact" class="border rounded">
          <thead>
            <tr>
              <th>{{ t('tools.world-clock.zone') }}</th>
              <th>{{ t('tools.world-clock.localTime') }}</th>
              <th>{{ t('tools.world-clock.hours') }}</th>
            </tr>
          </thead>
          <tbody class="tabular-nums">
            <tr v-for="m in meeting" :key="m.zone">
              <td>{{ cityLabel(m.zone) }} <span class="text-caption text-medium-emphasis">{{ formatOffset(m.v.offset) }}</span></td>
              <td class="text-no-wrap">
                {{ formatDate(m.v.wall) }} {{ formatClock(m.v.wall) }}
                <span v-if="m.v.dayDiff !== 0" class="text-caption text-medium-emphasis">({{ dayLabel(m.v.dayDiff) }})</span>
              </td>
              <td>
                <v-icon :icon="m.working ? 'mdi-check-circle' : 'mdi-moon-waning-crescent'" :color="m.working ? 'success' : undefined" size="small" />
                {{ m.working ? t('tools.world-clock.working') : t('tools.world-clock.outside') }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
      <div class="mt-2"><CopyBtn :text="meetingText" :label-text="t('tools.world-clock.copyTimes')" /></div>

      <div class="text-subtitle-2 mt-5 mb-1">{{ t('tools.world-clock.timeline', { zone: cityLabel(base) }) }}</div>
      <div class="text-caption mb-2" :class="windows.length ? 'text-success' : 'text-medium-emphasis'">
        {{ windows.length ? t('tools.world-clock.overlap', { range: windowText }) : t('tools.world-clock.noOverlap') }}
      </div>
      <div class="overflow-x-auto border rounded pa-2">
        <div class="wc-grid">
          <div class="wc-label" />
          <div v-for="h in 24" :key="'h' + h" class="wc-head tabular-nums" :class="{ 'wc-sel': h - 1 === selectedHour }">{{ pad(h - 1) }}</div>
          <template v-for="(z, zi) in zones" :key="z">
            <div class="wc-label text-caption text-truncate">{{ cityLabel(z) }}</div>
            <div
              v-for="s in timeline"
              :key="z + s.hour"
              class="wc-cell tabular-nums"
              :class="{ 'wc-work': s.cells[zi].working, 'wc-all': s.allWorking, 'wc-sel': s.hour === selectedHour }"
              :title="`${cityLabel(z)} ${pad(s.cells[zi].hh)}:${pad(s.cells[zi].mm)}`"
            >
              {{ pad(s.cells[zi].hh) }}
            </div>
          </template>
        </div>
      </div>
      <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.world-clock.legend') }}</div>
    </template>
  </ToolShell>
</template>

<style scoped>
.wc-grid {
  display: grid;
  grid-template-columns: 96px repeat(24, minmax(26px, 1fr));
  gap: 2px;
  min-width: 720px;
}
.wc-label {
  display: flex;
  align-items: center;
  padding-right: 6px;
}
.wc-head,
.wc-cell {
  text-align: center;
  font-size: 11px;
  line-height: 24px;
  border-radius: 3px;
}
.wc-head {
  opacity: 0.7;
}
.wc-cell {
  background: rgba(var(--v-theme-on-surface), 0.06);
  opacity: 0.8;
}
.wc-work {
  background: rgba(var(--v-theme-success), 0.35);
  opacity: 1;
}
.wc-all {
  outline: 2px solid rgb(var(--v-theme-success));
  outline-offset: -2px;
}
.wc-sel {
  font-weight: 700;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}
</style>
