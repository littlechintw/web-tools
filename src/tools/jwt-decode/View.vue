<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { useHistory } from '@/composables/useHistory'
import { base64ToBytes, bytesToBase64 } from '@/utils/bytes'

const TOOL_ID = 'jwt-decode'
const { t } = useI18n()

const history = useHistory<{ token: string }>(TOOL_ID)

const token = ref('')
const error = ref('')

function decodeSegment(seg: string): string {
  return new TextDecoder().decode(base64ToBytes(seg))
}

interface Decoded {
  header: string
  payload: string
  payloadObj: Record<string, unknown>
}

const decoded = computed<Decoded | null>(() => {
  error.value = ''
  const raw = token.value.trim()
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 3) {
    error.value = t('tools.jwt-decode.invalidToken')
    return null
  }
  try {
    const headerObj = JSON.parse(decodeSegment(parts[0])) as Record<string, unknown>
    const payloadObj = JSON.parse(decodeSegment(parts[1])) as Record<string, unknown>
    return {
      header: JSON.stringify(headerObj, null, 2),
      payload: JSON.stringify(payloadObj, null, 2),
      payloadObj,
    }
  } catch {
    error.value = t('tools.jwt-decode.decodeError')
    return null
  }
})

const STANDARD = ['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti'] as const
const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat'])

interface ClaimRow {
  key: string
  name: string
  value: string
  readable: string
  status: '' | 'expired' | 'notYetValid'
}

const claimRows = computed<ClaimRow[]>(() => {
  const obj = decoded.value?.payloadObj
  // A valid JWT payload segment can decode to a non-object JSON value.
  if (!obj || typeof obj !== 'object') return []
  const now = Date.now()
  const rows: ClaimRow[] = []
  for (const key of STANDARD) {
    if (!(key in obj)) continue
    const v = obj[key]
    let readable = ''
    let status: ClaimRow['status'] = ''
    if (TIME_CLAIMS.has(key) && typeof v === 'number') {
      const ms = v * 1000
      readable = new Date(ms).toLocaleString()
      if (key === 'exp' && ms < now) status = 'expired'
      if (key === 'nbf' && ms > now) status = 'notYetValid'
    }
    rows.push({
      key,
      name: t(`tools.jwt-decode.claimNames.${key}`),
      value: typeof v === 'object' ? JSON.stringify(v) : String(v),
      readable,
      status,
    })
  }
  return rows
})

function loadExample() {
  const encode = (obj: Record<string, unknown>) =>
    bytesToBase64(new TextEncoder().encode(JSON.stringify(obj)), true)
  const now = Math.floor(Date.now() / 1000)
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const payload = encode({
    iss: 'https://tools.littlechin.tw',
    sub: '1234567890',
    name: 'Toolbox demo',
    iat: now,
    exp: now + 3600,
  })
  // Signatures aren't verified here, so a fixed placeholder segment is fine.
  token.value = `${header}.${payload}.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`
}

function save() {
  const raw = token.value.trim()
  if (!raw || !decoded.value) return
  history.save(`JWT: ${raw.slice(0, 40)}`, { token: raw })
}

watch(decoded, () => save())

history.restoreFromRoute((d) => {
  token.value = d.token
})
</script>

<template>
  <ToolShell>
    <v-alert type="info" variant="tonal" density="comfortable" class="mb-4">
      {{ t('tools.jwt-decode.note') }}
    </v-alert>

    <v-textarea
      v-model="token"
      :label="t('tools.jwt-decode.inputToken')"
      :error-messages="error"
      rows="4"
      auto-grow
      clearable
      hide-details="auto"
      class="code-area"
    />
    <div class="d-flex flex-wrap align-center ga-2 mt-2">
      <PasteBtn @paste="token = $event" />
      <v-btn variant="text" prepend-icon="mdi-lightbulb-outline" @click="loadExample">
        {{ t('common.loadExample') }}
      </v-btn>
    </div>

    <template v-if="decoded">
      <OutputPanel
        class="mt-4"
        :value="decoded.header"
        :label="t('tools.jwt-decode.header')"
        :rows="3"
        filename="header.json"
        mime="application/json"
      />

      <OutputPanel
        class="mt-4"
        :value="decoded.payload"
        :label="t('tools.jwt-decode.payload')"
        filename="payload.json"
        mime="application/json"
      />

      <template v-if="claimRows.length">
        <h2 class="text-subtitle-1 font-weight-bold mt-4 mb-2">{{ t('tools.jwt-decode.claims') }}</h2>
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>{{ t('tools.jwt-decode.claim') }}</th>
              <th>{{ t('tools.jwt-decode.value') }}</th>
              <th>{{ t('tools.jwt-decode.readable') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in claimRows" :key="row.key">
              <td>{{ row.name }}</td>
              <td class="font-mono break-all text-body-2">{{ row.value }}</td>
              <td>
                <span v-if="row.readable">{{ row.readable }}</span>
                <v-chip v-if="row.status === 'expired'" color="error" size="x-small" class="ml-2">
                  {{ t('tools.jwt-decode.expired') }}
                </v-chip>
                <v-chip v-if="row.status === 'notYetValid'" color="warning" size="x-small" class="ml-2">
                  {{ t('tools.jwt-decode.notYetValid') }}
                </v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </template>
  </ToolShell>
</template>
