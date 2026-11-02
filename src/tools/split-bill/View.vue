<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { splitBill } from '@/lib/split-bill'

const { t, locale } = useI18n()

interface Row {
  id: number
  name: string
  paid: string
  weight: string
}
let nextId = 1
const newRow = (): Row => ({ id: nextId++, name: '', paid: '', weight: '1' })
const rows = ref<Row[]>([newRow(), newRow(), newRow()])

const MAX_PEOPLE = 30
const addRow = () => rows.value.length < MAX_PEOPLE && rows.value.push(newRow())
const removeRow = (id: number) => rows.value.length > 2 && (rows.value = rows.value.filter((r) => r.id !== id))
const reset = () => (rows.value = [newRow(), newRow(), newRow()])

const num = (s: string, empty: number) => (s.trim() === '' ? empty : Number(s))
const label = (i: number) => rows.value[i].name.trim() || t('tools.split-bill.person', { n: i + 1 })

const result = computed(() =>
  splitBill(rows.value.map((r) => ({ name: label(rows.value.indexOf(r)), paid: num(r.paid, 0), weight: num(r.weight, 1) }))),
)

const nf = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }))
const fmt = (n: number) => nf.value.format(n)

const summary = computed(() => {
  const r = result.value
  if (!r) return ''
  const lines = [`${t('tools.split-bill.total')}: ${fmt(r.total)}`]
  if (r.transfers.length === 0) lines.push(t('tools.split-bill.settled'))
  for (const x of r.transfers) lines.push(`${label(x.from)} → ${label(x.to)}: ${fmt(x.amount)}`)
  return lines.join('\n')
})
</script>

<template>
  <ToolShell>
    <div class="text-caption text-medium-emphasis mb-2">{{ t('tools.split-bill.hint') }}</div>

    <v-card v-for="(row, i) in rows" :key="row.id" variant="outlined" class="pa-3 mb-2">
      <v-row density="comfortable" class="align-center">
        <v-col cols="9" sm="4">
          <v-text-field
            v-model="row.name"
            :label="t('tools.split-bill.name')"
            :placeholder="t('tools.split-bill.person', { n: i + 1 })"
            maxlength="30"
            hide-details
          />
        </v-col>
        <v-col cols="3" sm="1" class="text-end order-sm-last">
          <v-btn
            icon="mdi-delete-outline"
            variant="text"
            size="small"
            :disabled="rows.length <= 2"
            :title="t('tools.split-bill.remove')"
            :aria-label="t('tools.split-bill.remove')"
            @click="removeRow(row.id)"
          />
        </v-col>
        <v-col cols="7" sm="4">
          <v-text-field v-model="row.paid" :label="t('tools.split-bill.paid')" type="number" min="0" inputmode="numeric" hide-details class="tabular-nums" />
        </v-col>
        <v-col cols="5" sm="3">
          <v-text-field v-model="row.weight" :label="t('tools.split-bill.weight')" type="number" min="0" step="1" inputmode="decimal" hide-details class="tabular-nums" />
        </v-col>
      </v-row>
    </v-card>

    <div class="d-flex flex-wrap ga-2 mt-2">
      <v-btn prepend-icon="mdi-plus" variant="tonal" :disabled="rows.length >= MAX_PEOPLE" @click="addRow">{{ t('tools.split-bill.addPerson') }}</v-btn>
      <v-btn variant="text" @click="reset">{{ t('common.reset') }}</v-btn>
    </div>

    <v-alert v-if="!result" type="info" variant="tonal" density="compact" class="mt-4">{{ t('tools.split-bill.invalid') }}</v-alert>

    <template v-else>
      <v-card variant="tonal" class="mt-4 pa-4">
        <div class="d-flex align-center justify-space-between ga-3">
          <div>
            <div class="text-caption text-medium-emphasis">{{ t('tools.split-bill.total') }}</div>
            <div class="text-h5 font-mono tabular-nums break-all">{{ fmt(result.total) }}</div>
          </div>
          <CopyBtn :text="summary" />
        </div>
      </v-card>

      <div class="text-subtitle-2 mt-5 mb-1">{{ t('tools.split-bill.shares') }}</div>
      <div class="overflow-x-auto">
        <v-table density="compact" class="border rounded">
          <thead>
            <tr>
              <th>{{ t('tools.split-bill.name') }}</th>
              <th class="text-end">{{ t('tools.split-bill.paid') }}</th>
              <th class="text-end">{{ t('tools.split-bill.share') }}</th>
              <th class="text-end">{{ t('tools.split-bill.balance') }}</th>
            </tr>
          </thead>
          <tbody class="tabular-nums">
            <tr v-for="(row, i) in rows" :key="row.id">
              <td>{{ label(i) }}</td>
              <td class="text-end">{{ fmt(num(row.paid, 0)) }}</td>
              <td class="text-end">{{ fmt(result.shares[i]) }}</td>
              <td class="text-end" :class="result.balances[i] > 0 ? 'text-success' : result.balances[i] < 0 ? 'text-error' : ''">
                {{ result.balances[i] > 0 ? '+' : '' }}{{ fmt(result.balances[i]) }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
      <div class="text-caption text-medium-emphasis mt-1">{{ t('tools.split-bill.balanceNote') }}</div>

      <div class="text-subtitle-2 mt-5 mb-1">{{ t('tools.split-bill.settlement') }}</div>
      <v-alert v-if="result.transfers.length === 0" type="success" variant="tonal" density="compact">{{ t('tools.split-bill.settled') }}</v-alert>
      <v-list v-else density="compact" class="border rounded py-0">
        <v-list-item v-for="(x, k) in result.transfers" :key="k" class="px-3">
          <div class="d-flex align-center flex-wrap ga-2">
            <span class="break-all">{{ label(x.from) }}</span>
            <v-icon icon="mdi-arrow-right" size="small" />
            <span class="break-all">{{ label(x.to) }}</span>
            <v-spacer />
            <strong class="font-mono tabular-nums">{{ fmt(x.amount) }}</strong>
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-qrcode"
              :to="{ path: '/twqr-generate', query: { amount: String(x.amount) } }"
              :title="t('tools.split-bill.makeQr')"
            >TWQR</v-btn>
          </div>
        </v-list-item>
      </v-list>
      <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.split-bill.note') }}</div>
    </template>
  </ToolShell>
</template>
