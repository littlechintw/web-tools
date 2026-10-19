<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { isBoolean, isNumber, useStoredRef } from '@/composables/useStoredRef'

const { t } = useI18n()

const intBetween = (min: number, max: number) => (v: unknown): v is number =>
  isNumber(v) && Number.isInteger(v) && v >= min && v <= max

// Every option is a preference, remembered between visits.
const length = useStoredRef('password-generator.length', 16, intBetween(4, 64))
const useUpper = useStoredRef('password-generator.upper', true, isBoolean)
const useLower = useStoredRef('password-generator.lower', true, isBoolean)
const useDigits = useStoredRef('password-generator.digits', true, isBoolean)
const useSymbols = useStoredRef('password-generator.symbols', true, isBoolean)
const excludeAmbiguous = useStoredRef('password-generator.excludeAmbiguous', false, isBoolean)
const count = useStoredRef('password-generator.count', 1, intBetween(1, 20))

const passwords = ref<string[]>([])

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/'
const AMBIGUOUS = new Set(['0', 'O', '1', 'l', 'I'])

const charset = computed(() => {
  let chars = ''
  if (useUpper.value) chars += UPPER
  if (useLower.value) chars += LOWER
  if (useDigits.value) chars += DIGITS
  if (useSymbols.value) chars += SYMBOLS
  if (excludeAmbiguous.value) {
    chars = [...chars].filter((c) => !AMBIGUOUS.has(c)).join('')
  }
  return chars
})

/** Uniform random integer in [0, max) using rejection sampling — no modulo bias. */
function randomIndex(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  let x: number
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= limit)
  return x % max
}

function generateOne(chars: string): string {
  let out = ''
  for (let i = 0; i < length.value; i++) {
    out += chars[randomIndex(chars.length)]
  }
  return out
}

function regenerate() {
  const chars = charset.value
  if (!chars) {
    passwords.value = []
    return
  }
  const result: string[] = []
  for (let i = 0; i < count.value; i++) result.push(generateOne(chars))
  passwords.value = result
}

const entropyBits = computed(() => {
  const chars = charset.value
  if (!chars) return 0
  return Math.round(length.value * Math.log2(chars.length))
})

const strength = computed(() => {
  const bits = entropyBits.value
  if (bits < 28) return { key: 'veryWeak', color: 'error', pct: 15 }
  if (bits < 50) return { key: 'weak', color: 'warning', pct: 35 }
  if (bits < 70) return { key: 'fair', color: 'amber', pct: 55 }
  if (bits < 100) return { key: 'strong', color: 'light-green', pct: 80 }
  return { key: 'veryStrong', color: 'success', pct: 100 }
})

const allText = computed(() => passwords.value.join('\n'))

onMounted(() => regenerate())
</script>

<template>
  <ToolShell>
    <div class="mb-2">
      <div class="d-flex justify-space-between">
        <span class="text-body-2">{{ t('tools.password-generator.length') }}</span>
        <span class="text-body-2 font-weight-bold tabular-nums">{{ length }}</span>
      </div>
      <v-slider v-model="length" :min="4" :max="64" :step="1" hide-details @update:model-value="regenerate" />
    </div>

    <div class="d-flex flex-wrap gc-6">
      <v-checkbox v-model="useUpper" :label="t('tools.password-generator.uppercase')" hide-details density="compact" @update:model-value="regenerate" />
      <v-checkbox v-model="useLower" :label="t('tools.password-generator.lowercase')" hide-details density="compact" @update:model-value="regenerate" />
      <v-checkbox v-model="useDigits" :label="t('tools.password-generator.digits')" hide-details density="compact" @update:model-value="regenerate" />
      <v-checkbox v-model="useSymbols" :label="t('tools.password-generator.symbols')" hide-details density="compact" @update:model-value="regenerate" />
      <v-checkbox v-model="excludeAmbiguous" :label="t('tools.password-generator.excludeAmbiguous')" hide-details density="compact" @update:model-value="regenerate" />
    </div>

    <div class="d-flex flex-wrap align-center ga-4 mt-3">
      <v-select
        v-model="count"
        :items="Array.from({ length: 20 }, (_, i) => i + 1)"
        :label="t('tools.password-generator.count')"
        hide-details
        density="compact"
        style="max-width: 140px"
        @update:model-value="regenerate"
      />
      <v-btn prepend-icon="mdi-refresh" color="primary" variant="tonal" @click="regenerate">
        {{ t('tools.password-generator.regenerate') }}
      </v-btn>
    </div>

    <v-alert v-if="!charset" type="warning" variant="tonal" density="comfortable" class="mt-4">
      {{ t('tools.password-generator.noCharset') }}
    </v-alert>

    <template v-else>
      <div class="mt-4">
        <div class="d-flex justify-space-between mb-1">
          <span class="text-body-2">
            {{ t('tools.password-generator.strength') }}:
            <strong>{{ t('tools.password-generator.' + strength.key) }}</strong>
          </span>
          <span class="text-body-2 text-medium-emphasis tabular-nums">
            {{ entropyBits }} {{ t('tools.password-generator.bits') }}
          </span>
        </div>
        <v-progress-linear :model-value="strength.pct" :color="strength.color" height="8" rounded />
      </div>

      <div v-for="(pw, i) in passwords" :key="i" class="d-flex align-center ga-2 mt-3">
        <v-text-field :model-value="pw" readonly hide-details density="compact" class="code-area flex-grow-1" />
        <CopyBtn :text="pw" icon />
      </div>

      <OutputPanel
        v-if="passwords.length > 1"
        class="mt-4"
        :value="allText"
        :label="t('tools.password-generator.allPasswords')"
        :rows="3"
        filename="passwords.txt"
        hide-count
      />
    </template>
  </ToolShell>
</template>
