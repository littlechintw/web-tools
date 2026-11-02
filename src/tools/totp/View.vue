<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { base32Decode, parseOtpauth, totp, type TotpAlgorithm } from '@/lib/totp'

// Deliberately no useHistory and no persistence of the secret: it lives only in this ref.
const { t } = useI18n()
const ALGOS = ['SHA-1', 'SHA-256', 'SHA-512'] as const
const DIGITS = [6, 7, 8] as const
const PERIODS = [30, 60] as const
const algorithm = useStoredRef<TotpAlgorithm>('totp.algorithm', 'SHA-1', oneOf(ALGOS))
const digits = useStoredRef<(typeof DIGITS)[number]>('totp.digits', 6, oneOf(DIGITS))
const period = useStoredRef<(typeof PERIODS)[number]>('totp.period', 30, oneOf(PERIODS))

const input = ref('')
const show = ref(false)
const info = ref('')
const now = ref(Date.now())
const current = ref<string | null>(null)
const next = ref<string | null>(null)

const secret = computed(() => {
  const s = input.value.trim()
  if (!s || /^otpauth:\/\//i.test(s)) return null
  return base32Decode(s)
})
const invalid = computed(() => input.value.trim() !== '' && !/^otpauth:\/\//i.test(input.value.trim()) && !secret.value)

const counter = computed(() => Math.floor(now.value / 1000 / period.value))
const remaining = computed(() => period.value - ((now.value / 1000) % period.value))
const progress = computed(() => (remaining.value / period.value) * 100)

let seq = 0
async function compute() {
  const k = secret.value
  const my = ++seq
  if (!k) {
    current.value = next.value = null
    return
  }
  const opts = { algorithm: algorithm.value, digits: digits.value, period: period.value }
  const sec = counter.value * period.value
  const [c, n] = await Promise.all([totp(k, sec, opts), totp(k, sec + period.value, opts)])
  if (my === seq) {
    current.value = c
    next.value = n
  }
}
watch([secret, algorithm, digits, period, counter], compute, { immediate: true })

watch(input, (v) => {
  if (!/^otpauth:\/\//i.test(v.trim())) {
    info.value = ''
    return
  }
  const p = parseOtpauth(v)
  if (!p) {
    info.value = t('tools.totp.badUri')
    return
  }
  info.value = [p.issuer, p.label].filter(Boolean).join(' — ')
  algorithm.value = p.algorithm
  if ((DIGITS as readonly number[]).includes(p.digits)) digits.value = p.digits as (typeof DIGITS)[number]
  if ((PERIODS as readonly number[]).includes(p.period)) period.value = p.period as (typeof PERIODS)[number]
  else info.value += ` (${t('tools.totp.periodUnsupported', { n: p.period })})`
  input.value = p.secret
})

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 250)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  input.value = ''
})

const group = (s: string | null) => (s ? s.replace(/^(.{3})(.+)$/, '$1 $2') : '------')
const algoItems = ALGOS.map((a) => ({ title: a, value: a }))
const digitItems = DIGITS.map((d) => ({ title: String(d), value: d }))
const periodItems = computed(() => PERIODS.map((p) => ({ title: t('tools.totp.seconds', { n: p }), value: p })))
</script>

<template>
  <ToolShell max-width="700">
    <v-alert type="info" variant="tonal" density="compact" icon="mdi-lock-outline" class="mb-4">
      {{ t('tools.totp.privacy') }}
    </v-alert>

    <div class="d-flex ga-2 align-start">
      <v-text-field
        v-model="input"
        :label="t('tools.totp.secret')"
        :type="show ? 'text' : 'password'"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :error="invalid"
        :error-messages="invalid ? [t('tools.totp.badSecret')] : []"
        :hint="t('tools.totp.secretHint')"
        persistent-hint
        class="code-area"
        :append-inner-icon="show ? 'mdi-eye-off' : 'mdi-eye'"
        @click:append-inner="show = !show"
      />
      <PasteBtn @paste="input = $event" />
    </div>
    <div v-if="info" class="text-caption text-medium-emphasis mt-1">{{ info }}</div>

    <v-row density="comfortable" class="mt-2">
      <v-col cols="4"><v-select v-model="algorithm" :items="algoItems" :label="t('tools.totp.algorithm')" hide-details /></v-col>
      <v-col cols="4"><v-select v-model="digits" :items="digitItems" :label="t('tools.totp.digits')" hide-details /></v-col>
      <v-col cols="4"><v-select v-model="period" :items="periodItems" :label="t('tools.totp.period')" hide-details /></v-col>
    </v-row>

    <v-card variant="tonal" class="mt-4 pa-4">
      <div class="d-flex align-center ga-4">
        <v-progress-circular :model-value="progress" :size="64" :width="6" :color="remaining <= 5 ? 'error' : 'primary'">
          <span class="tabular-nums text-body-2">{{ Math.ceil(remaining) }}</span>
        </v-progress-circular>
        <div class="flex-grow-1">
          <div class="text-caption text-medium-emphasis">{{ t('tools.totp.current') }}</div>
          <div class="text-h4 font-mono tabular-nums" aria-live="off">{{ group(current) }}</div>
        </div>
        <CopyBtn :text="current ?? ''" icon />
      </div>
      <div class="mt-3 d-flex align-center ga-3">
        <div class="text-caption text-medium-emphasis">{{ t('tools.totp.next') }}</div>
        <div class="text-h6 font-mono tabular-nums text-medium-emphasis">{{ group(next) }}</div>
      </div>
    </v-card>
  </ToolShell>
</template>
