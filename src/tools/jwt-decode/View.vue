<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'jwt-decode'
const { t } = useI18n()
const route = useRoute()

const history = useHistory<{ token: string }>(TOOL_ID)

const token = ref('')
const error = ref('')

function base64UrlDecode(seg: string): string {
  let b64 = seg.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
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
    const headerObj = JSON.parse(base64UrlDecode(parts[0])) as Record<string, unknown>
    const payloadObj = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>
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
  if (!obj) return []
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

function save() {
  const raw = token.value.trim()
  if (!raw || !decoded.value) return
  history.save(`JWT: ${raw.slice(0, 40)}`, { token: raw })
}

watch(decoded, () => save())

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) token.value = e.data.token
  }
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
      class="code-area"
    />

    <template v-if="decoded">
      <div class="d-flex align-center ga-2 mt-4 mb-1">
        <h2 class="text-subtitle-1 font-weight-bold">{{ t('tools.jwt-decode.header') }}</h2>
        <CopyBtn :text="decoded.header" icon size="small" />
      </div>
      <v-textarea :model-value="decoded.header" rows="4" auto-grow readonly class="code-area" />

      <div class="d-flex align-center ga-2 mt-4 mb-1">
        <h2 class="text-subtitle-1 font-weight-bold">{{ t('tools.jwt-decode.payload') }}</h2>
        <CopyBtn :text="decoded.payload" icon size="small" />
      </div>
      <v-textarea :model-value="decoded.payload" rows="6" auto-grow readonly class="code-area" />

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
              <td class="code-cell">{{ row.value }}</td>
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

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
.code-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  word-break: break-all;
}
</style>
