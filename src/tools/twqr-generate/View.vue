<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import QRCode from 'qrcode'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useStoredRef } from '@/composables/useStoredRef'
import { TW_BANKS, bankName } from '@/lib/twBanks'
import {
  MAX_AMOUNT,
  MAX_NOTE_LENGTH,
  buildTwqr,
  formatAccount,
  isValidAmount,
  isShortAccount,
  isValidAccount,
  maskAccount,
  normalizeAccount,
} from '@/lib/twqr'
import { downloadUrl } from '@/utils/download'
import { nanoid } from '@/utils/nanoid'

interface Account {
  id: string
  label: string
  bankCode: string
  account: string
}

const { t } = useI18n()

// Saved accounts are the one thing this tool persists on purpose: they live
// only in this browser's localStorage and are never sent anywhere.
const isAccountList = (v: unknown): v is Account[] =>
  Array.isArray(v) &&
  v.every(
    (a) =>
      a && typeof a.id === 'string' && typeof a.label === 'string' && typeof a.bankCode === 'string' && typeof a.account === 'string',
  )
const accounts = useStoredRef<Account[]>('twqr.accounts', [], isAccountList)
const selectedId = useStoredRef<string>('twqr.selected', '')

const selected = computed(() => accounts.value.find((a) => a.id === selectedId.value) ?? accounts.value[0] ?? null)

// Other tools (e.g. split-bill) link here with ?amount=<n>. Only a valid whole
// amount is accepted; anything else in the URL is ignored.
const queryAmount = Number(useRoute().query.amount)
const amount = ref(isValidAmount(queryAmount) ? String(queryAmount) : '')
const note = ref('')

const bankItems = TW_BANKS.map(([code, name]) => ({ title: `${code} ${name}`, value: code }))

/* ---------- add / edit dialog ---------- */
const dialog = ref(false)
const editingId = ref<string | null>(null)
const formLabel = ref('')
const formBank = ref<string | null>(null)
const formAccount = ref('')
const confirmDelete = ref(false)

function openForm(a?: Account) {
  editingId.value = a?.id ?? null
  formLabel.value = a?.label ?? ''
  formBank.value = a?.bankCode ?? null
  formAccount.value = a?.account ?? ''
  confirmDelete.value = false
  dialog.value = true
}

const formDigits = computed(() => normalizeAccount(formAccount.value))
const accountWarning = computed(() =>
  formDigits.value && !isValidAccount(formDigits.value)
    ? isShortAccount(formDigits.value)
      ? t('tools.twqr-generate.shortAccount')
      : ''
    : '',
)
const canSave = computed(() => !!formBank.value && formDigits.value.length > 0)

function save() {
  if (!canSave.value || !formBank.value) return
  const entry: Account = {
    id: editingId.value ?? nanoid(10),
    label: formLabel.value.trim().slice(0, 30),
    bankCode: formBank.value,
    account: formDigits.value,
  }
  if (editingId.value) {
    accounts.value = accounts.value.map((a) => (a.id === entry.id ? entry : a))
  } else {
    accounts.value = [...accounts.value, entry]
  }
  selectedId.value = entry.id
  dialog.value = false
}

function remove() {
  if (!editingId.value) return
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  accounts.value = accounts.value.filter((a) => a.id !== editingId.value)
  dialog.value = false
}

/* ---------- payload + QR ---------- */
const amountNum = computed(() => (amount.value.trim() === '' ? 0 : Number(amount.value)))
const amountError = computed(() => {
  if (amount.value.trim() === '') return ''
  const n = Number(amount.value)
  return Number.isInteger(n) && n > 0 && n <= MAX_AMOUNT ? '' : t('tools.twqr-generate.amountInvalid')
})

const payload = computed(() => {
  const a = selected.value
  if (!a || amountError.value) return ''
  return buildTwqr({ bankCode: a.bankCode, account: a.account, amount: amountNum.value, note: note.value }) ?? ''
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
async function render() {
  await nextTick()
  const el = canvasRef.value
  if (!el || !payload.value) return
  await QRCode.toCanvas(el, payload.value, { width: 300, margin: 2, errorCorrectionLevel: 'M' })
}
watch(payload, render, { flush: 'post' })
watch(canvasRef, render)

function download() {
  const el = canvasRef.value
  if (!el || !payload.value) return
  const a = selected.value
  downloadUrl(el.toDataURL('image/png'), `twqr-${a?.bankCode ?? ''}${amountNum.value ? `-${amountNum.value}` : ''}.png`)
}

const showFull = ref(false)
watch(selected, () => (showFull.value = false))
const accountDisplay = computed(() => {
  const a = selected.value
  if (!a) return ''
  return showFull.value ? formatAccount(a.account) : maskAccount(a.account)
})
</script>

<template>
  <ToolShell>
    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('tools.twqr-generate.privacy') }}
    </v-alert>

    <v-row density="comfortable">
      <!-- accounts -->
      <v-col cols="12" md="5">
        <div class="d-flex align-center justify-space-between mb-2">
          <div class="text-subtitle-2">{{ t('tools.twqr-generate.accounts') }}</div>
          <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="openForm()">{{ t('tools.twqr-generate.add') }}</v-btn>
        </div>

        <v-card v-if="!accounts.length" variant="outlined" class="pa-4 text-medium-emphasis text-body-2">
          {{ t('tools.twqr-generate.empty') }}
        </v-card>

        <v-list v-else v-model:selected="selectedId" select-strategy="single-leaf" density="comfortable" class="border rounded pa-0">
          <v-list-item
            v-for="a in accounts"
            :key="a.id"
            :value="a.id"
            :active="selected?.id === a.id"
            :title="a.label || bankName(a.bankCode) || a.bankCode"
            :subtitle="`${a.bankCode} ${bankName(a.bankCode)} · ${maskAccount(a.account)}`"
            @click="selectedId = a.id"
          >
            <template #append>
              <v-btn
                icon="mdi-pencil"
                size="small"
                variant="text"
                :title="t('tools.twqr-generate.edit')"
                :aria-label="t('tools.twqr-generate.edit')"
                @click.stop="openForm(a)"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-col>

      <!-- QR -->
      <v-col cols="12" md="7">
        <template v-if="selected">
          <v-row density="comfortable">
            <v-col cols="12" sm="5">
              <v-text-field
                v-model="amount"
                :label="t('tools.twqr-generate.amount')"
                :hint="t('tools.twqr-generate.amountHint')"
                :error-messages="amountError"
                persistent-hint
                type="number"
                min="1"
                prefix="NT$"
                inputmode="numeric"
                class="tabular-nums"
              />
            </v-col>
            <v-col cols="12" sm="7">
              <v-text-field
                v-model="note"
                :label="t('tools.twqr-generate.note')"
                :hint="t('tools.twqr-generate.noteHint')"
                persistent-hint
                :maxlength="MAX_NOTE_LENGTH"
                counter
              />
            </v-col>
          </v-row>

          <v-card variant="outlined" class="mt-4 pa-4 d-flex flex-column align-center">
            <div class="text-body-1 font-weight-medium">{{ selected.label || bankName(selected.bankCode) }}</div>
            <div class="text-caption text-medium-emphasis d-flex align-center">
              {{ selected.bankCode }} {{ bankName(selected.bankCode) }} ·
              <span class="font-mono tabular-nums ml-1">{{ accountDisplay }}</span>
              <v-btn
                :icon="showFull ? 'mdi-eye-off' : 'mdi-eye'"
                size="x-small"
                variant="text"
                :title="t('tools.twqr-generate.toggleAccount')"
                :aria-label="t('tools.twqr-generate.toggleAccount')"
                @click="showFull = !showFull"
              />
            </div>
            <div v-if="amountNum > 0 && !amountError" class="text-h6 tabular-nums mt-1">NT$ {{ amountNum.toLocaleString() }}</div>
            <div v-else class="text-caption text-medium-emphasis mt-1">{{ t('tools.twqr-generate.anyAmount') }}</div>

            <canvas v-if="payload" ref="canvasRef" class="mt-3 rounded" style="max-width: 100%; background: #fff" />

            <div v-if="payload" class="d-flex ga-2 mt-3">
              <v-btn variant="tonal" prepend-icon="mdi-download" @click="download">PNG</v-btn>
              <CopyBtn :text="payload" />
            </div>
          </v-card>
          <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.twqr-generate.note2') }}</div>
        </template>
      </v-col>
    </v-row>

    <v-dialog v-model="dialog" max-width="460">
      <v-card :title="editingId ? t('tools.twqr-generate.edit') : t('tools.twqr-generate.add')">
        <v-card-text class="d-flex flex-column ga-3">
          <v-text-field v-model="formLabel" :label="t('tools.twqr-generate.label')" :hint="t('tools.twqr-generate.labelHint')" persistent-hint maxlength="30" />
          <v-autocomplete v-model="formBank" :items="bankItems" :label="t('tools.twqr-generate.bank')" no-data-text="—" />
          <v-text-field
            v-model="formAccount"
            :label="t('tools.twqr-generate.account')"
            inputmode="numeric"
            :hint="accountWarning || t('tools.twqr-generate.accountHint')"
            persistent-hint
            class="font-mono"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn v-if="editingId" color="error" variant="text" @click="remove">
            {{ confirmDelete ? t('tools.twqr-generate.confirmDelete') : t('tools.twqr-generate.delete') }}
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!canSave" @click="save">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </ToolShell>
</template>
