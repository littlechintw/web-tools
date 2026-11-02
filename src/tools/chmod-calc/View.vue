<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useStoredRef } from '@/composables/useStoredRef'
import {
  applyUmask,
  chmodCommand,
  formatUmask,
  getPerm,
  isWorldWritable,
  modeToOctal,
  modeToSymbolic,
  octalToMode,
  parseUmask,
  setPerm,
  setSpecial,
  SETGID,
  SETUID,
  STICKY,
  symbolicToMode,
  WHO,
  type Who,
} from '@/lib/chmod'

const TOOL_ID = 'chmod-calc'
const { t } = useI18n()
const T = (key: string, named?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, named ?? {})

const BITS = ['r', 'w', 'x'] as const
const SPECIALS = [
  { flag: SETUID, key: 'setuid' },
  { flag: SETGID, key: 'setgid' },
  { flag: STICKY, key: 'sticky' },
] as const

const mode = ref(0o755)
const octalText = ref('755')
const symText = ref('rwxr-xr-x')
const target = ref('file')
const umaskText = useStoredRef('chmod-calc.umask', '022')

watch(
  mode,
  (m) => {
    // Don't overwrite what the user is typing if it already means the same mode.
    if (octalToMode(octalText.value) !== m) octalText.value = modeToOctal(m)
    if (symbolicToMode(symText.value) !== m) symText.value = modeToSymbolic(m)
  },
  { immediate: true },
)

const octalInvalid = computed(() => octalToMode(octalText.value) === null)
const symInvalid = computed(() => symbolicToMode(symText.value) === null)

function onOctal(v: string) {
  octalText.value = v
  const m = octalToMode(v)
  if (m !== null) mode.value = m
}
function onSym(v: string) {
  symText.value = v
  const m = symbolicToMode(v)
  if (m !== null) mode.value = m
}

const safeTarget = computed(() => (/^[\w./@+-]+$/.test(target.value) && target.value ? target.value : target.value.trim() ? `'${target.value.replace(/'/g, `'\\''`)}'` : 'file'))
const cmdOctal = computed(() => chmodCommand(mode.value, safeTarget.value))
const cmdSymbolic = computed(() => chmodCommand(mode.value, safeTarget.value, true))

const perm = (who: Who, bit: (typeof BITS)[number]) => getPerm(mode.value, who)[bit]
function toggle(who: Who, bit: (typeof BITS)[number], on: boolean | null) {
  mode.value = setPerm(mode.value, who, bit, !!on)
}
function toggleSpecial(flag: (typeof SPECIALS)[number]['flag'], on: boolean | null) {
  mode.value = setSpecial(mode.value, flag, !!on)
}

const explanation = computed(() =>
  WHO.map((w) => {
    const p = getPerm(mode.value, w)
    const list = BITS.filter((b) => p[b]).map((b) => T(`perm.${b}`))
    return { who: w, text: list.length ? list.join(T('sep')) : T('noAccess') }
  }),
)
const notes = computed(() => {
  const m = mode.value
  const out: string[] = []
  if (m & SETUID) out.push(T('noteSetuid'))
  if (m & SETGID) out.push(T('noteSetgid'))
  if (m & STICKY) out.push(T('noteSticky'))
  if (isWorldWritable(m) && !(m & STICKY)) out.push(T('warnWorldWritable'))
  return out
})

const umask = computed(() => parseUmask(umaskText.value))
const umaskResult = computed(() => {
  if (umask.value === null) return null
  const r = applyUmask(umask.value)
  return {
    file: { octal: modeToOctal(r.file), sym: modeToSymbolic(r.file) },
    dir: { octal: modeToOctal(r.dir), sym: modeToSymbolic(r.dir) },
  }
})
const UMASK_PRESETS = ['022', '002', '027', '077']
</script>

<template>
  <ToolShell>
    <v-card variant="outlined" class="pa-4">
      <div class="perm-grid">
        <span />
        <span v-for="b in BITS" :key="b" class="text-center text-caption text-medium-emphasis">{{ T(`perm.${b}`) }}</span>
        <template v-for="w in WHO" :key="w">
          <span class="font-weight-medium">{{ T(`who.${w}`) }}</span>
          <v-checkbox
            v-for="b in BITS"
            :key="b"
            :model-value="perm(w, b)"
            :aria-label="`${T(`who.${w}`)} ${T(`perm.${b}`)}`"
            hide-details
            density="comfortable"
            class="justify-center"
            @update:model-value="toggle(w, b, $event)"
          />
        </template>
      </div>
      <v-divider class="my-3" />
      <div class="d-flex flex-wrap ga-x-4">
        <v-checkbox
          v-for="s in SPECIALS"
          :key="s.key"
          :model-value="!!(mode & s.flag)"
          :label="T(s.key)"
          hide-details
          density="comfortable"
          @update:model-value="toggleSpecial(s.flag, $event)"
        />
      </div>
    </v-card>

    <v-row density="comfortable" class="mt-2">
      <v-col cols="12" sm="5">
        <v-text-field
          :model-value="octalText"
          :label="T('octal')"
          :error="octalInvalid"
          :error-messages="octalInvalid ? [T('invalidOctal')] : []"
          maxlength="4"
          class="code-area"
          density="comfortable"
          spellcheck="false"
          autocomplete="off"
          @update:model-value="onOctal"
        />
      </v-col>
      <v-col cols="12" sm="7">
        <v-text-field
          :model-value="symText"
          :label="T('symbolic')"
          :error="symInvalid"
          :error-messages="symInvalid ? [T('invalidSymbolic')] : []"
          maxlength="10"
          class="code-area"
          density="comfortable"
          spellcheck="false"
          autocomplete="off"
          @update:model-value="onSym"
        />
      </v-col>
    </v-row>

    <v-text-field v-model="target" :label="T('target')" density="compact" hide-details class="code-area mb-3" spellcheck="false" autocomplete="off" />
    <div v-for="c in [cmdOctal, cmdSymbolic]" :key="c" class="d-flex align-center ga-2 mb-2">
      <code class="font-mono flex-grow-1 pa-2 rounded bg-surface-variant break-all">{{ c }}</code>
      <CopyBtn :text="c" icon />
    </div>

    <h2 class="text-subtitle-1 font-weight-medium mt-5 mb-2">{{ T('explain') }}</h2>
    <ul class="pl-5">
      <li v-for="e in explanation" :key="e.who">
        <strong>{{ T(`who.${e.who}`) }}</strong>: {{ e.text }}
      </li>
    </ul>
    <v-alert v-for="n in notes" :key="n" type="info" variant="tonal" density="compact" class="mt-2">{{ n }}</v-alert>

    <h2 class="text-subtitle-1 font-weight-medium mt-6 mb-2">{{ T('umaskTitle') }}</h2>
    <div class="d-flex flex-wrap align-center ga-2">
      <v-text-field
        v-model="umaskText"
        :label="T('umask')"
        :error="umask === null"
        :error-messages="umask === null ? [T('invalidOctal')] : []"
        maxlength="4"
        class="code-area"
        style="max-width: 160px"
        density="comfortable"
        spellcheck="false"
        autocomplete="off"
      />
      <v-chip v-for="p in UMASK_PRESETS" :key="p" size="small" variant="outlined" @click="umaskText = p">{{ p }}</v-chip>
    </div>
    <div v-if="umaskResult" class="mt-1">
      <p class="text-caption text-medium-emphasis mb-2">{{ T('umaskFormula', { umask: formatUmask(umask as number) }) }}</p>
      <div class="d-flex flex-column ga-1">
        <div>
          {{ T('newFile') }}: <span class="font-mono tabular-nums">{{ umaskResult.file.octal }}</span>
          (<span class="font-mono">{{ umaskResult.file.sym }}</span>)
        </div>
        <div>
          {{ T('newDir') }}: <span class="font-mono tabular-nums">{{ umaskResult.dir.octal }}</span>
          (<span class="font-mono">{{ umaskResult.dir.sym }}</span>)
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
.perm-grid {
  display: grid;
  grid-template-columns: minmax(70px, 1fr) repeat(3, 1fr);
  align-items: center;
  max-width: 420px;
}
</style>
