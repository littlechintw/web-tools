<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import QRCode from 'qrcode'
import type { QRCodeErrorCorrectionLevel } from 'qrcode'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'qrcode-generate'
const { t } = useI18n()
const route = useRoute()

type ContentType = 'text' | 'wifi' | 'vcard'

interface SavedData {
  type: ContentType
  text: string
  ssid: string
  password: string
  encryption: 'WPA' | 'WEP' | 'nopass'
  wifiHidden: boolean
  name: string
  phone: string
  email: string
  org: string
  size: number
  ecLevel: QRCodeErrorCorrectionLevel
  fg: string
  bg: string
}

const history = useHistory<SavedData>(TOOL_ID)

const type = ref<ContentType>('text')
const text = ref('https://example.com')
const ssid = ref('')
const password = ref('')
const encryption = ref<'WPA' | 'WEP' | 'nopass'>('WPA')
const wifiHidden = ref(false)
const name = ref('')
const phone = ref('')
const email = ref('')
const org = ref('')

const size = ref(256)
const ecLevel = ref<QRCodeErrorCorrectionLevel>('M')
const fg = ref('#000000')
const bg = ref('#ffffff')

const canvasRef = ref<HTMLCanvasElement>()

/** Escape WiFi/vCard reserved characters. */
function escapeWifi(s: string): string {
  return s.replace(/([\\;,:"])/g, '\\$1')
}
function escapeVcard(s: string): string {
  return s.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n')
}

const payload = computed(() => {
  if (type.value === 'text') {
    return text.value
  }
  if (type.value === 'wifi') {
    if (!ssid.value) return ''
    const enc = encryption.value
    const pass = enc === 'nopass' ? '' : escapeWifi(password.value)
    const hidden = wifiHidden.value ? 'H:true;' : ''
    return `WIFI:T:${enc};S:${escapeWifi(ssid.value)};P:${pass};${hidden};`
  }
  // vCard 3.0
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVcard(name.value)}`,
    `FN:${escapeVcard(name.value)}`,
  ]
  if (org.value) lines.push(`ORG:${escapeVcard(org.value)}`)
  if (phone.value) lines.push(`TEL;TYPE=CELL:${escapeVcard(phone.value)}`)
  if (email.value) lines.push(`EMAIL:${escapeVcard(email.value)}`)
  lines.push('END:VCARD')
  if (!name.value && !phone.value && !email.value && !org.value) return ''
  return lines.join('\n')
})

const error = ref('')

async function render() {
  await nextTick()
  const el = canvasRef.value
  if (!el) return
  const data = payload.value
  const ctx = el.getContext('2d')
  if (!data) {
    el.width = size.value
    el.height = size.value
    ctx?.clearRect(0, 0, el.width, el.height)
    error.value = ''
    return
  }
  try {
    await QRCode.toCanvas(el, data, {
      width: size.value,
      errorCorrectionLevel: ecLevel.value,
      margin: 2,
      color: { dark: fg.value, light: bg.value },
    })
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function download() {
  const el = canvasRef.value
  if (!el || !payload.value) return
  const url = el.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `qrcode-${Date.now()}.png`
  a.click()
}

function snapshot(): SavedData {
  return {
    type: type.value,
    text: text.value,
    ssid: ssid.value,
    password: password.value,
    encryption: encryption.value,
    wifiHidden: wifiHidden.value,
    name: name.value,
    phone: phone.value,
    email: email.value,
    org: org.value,
    size: size.value,
    ecLevel: ecLevel.value,
    fg: fg.value,
    bg: bg.value,
  }
}

function save() {
  if (!payload.value) return
  history.save(payload.value.slice(0, 50), snapshot())
}

watch(
  [type, text, ssid, password, encryption, wifiHidden, name, phone, email, org, size, ecLevel, fg, bg],
  () => {
    render()
    save()
  },
)

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      const d = e.data
      type.value = d.type
      text.value = d.text
      ssid.value = d.ssid
      password.value = d.password
      encryption.value = d.encryption
      wifiHidden.value = d.wifiHidden
      name.value = d.name
      phone.value = d.phone
      email.value = d.email
      org.value = d.org
      size.value = d.size
      ecLevel.value = d.ecLevel
      fg.value = d.fg
      bg.value = d.bg
    }
  }
  render()
})

const typeItems = computed(() => [
  { title: t('tools.qrcode-generate.typeText'), value: 'text' },
  { title: t('tools.qrcode-generate.typeWifi'), value: 'wifi' },
  { title: t('tools.qrcode-generate.typeVcard'), value: 'vcard' },
])
const ecItems = ['L', 'M', 'Q', 'H']
const encItems = computed(() => [
  { title: 'WPA/WPA2', value: 'WPA' },
  { title: 'WEP', value: 'WEP' },
  { title: t('tools.qrcode-generate.encNone'), value: 'nopass' },
])
</script>

<template>
  <ToolShell>
    <v-select
      v-model="type"
      :items="typeItems"
      :label="t('tools.qrcode-generate.contentType')"
      density="comfortable"
      class="mb-2"
    />

    <!-- Text / URL -->
    <template v-if="type === 'text'">
      <v-textarea v-model="text" :label="t('tools.qrcode-generate.text')" rows="3" auto-grow clearable />
    </template>

    <!-- WiFi -->
    <template v-else-if="type === 'wifi'">
      <v-text-field v-model="ssid" :label="t('tools.qrcode-generate.ssid')" density="comfortable" />
      <v-text-field
        v-model="password"
        :label="t('tools.qrcode-generate.password')"
        :disabled="encryption === 'nopass'"
        density="comfortable"
      />
      <v-select
        v-model="encryption"
        :items="encItems"
        :label="t('tools.qrcode-generate.encryption')"
        density="comfortable"
      />
      <v-checkbox v-model="wifiHidden" :label="t('tools.qrcode-generate.wifiHidden')" hide-details density="compact" />
    </template>

    <!-- vCard -->
    <template v-else>
      <v-text-field v-model="name" :label="t('tools.qrcode-generate.name')" density="comfortable" />
      <v-text-field v-model="phone" :label="t('tools.qrcode-generate.phone')" density="comfortable" />
      <v-text-field v-model="email" :label="t('tools.qrcode-generate.email')" density="comfortable" />
      <v-text-field v-model="org" :label="t('tools.qrcode-generate.org')" density="comfortable" />
    </template>

    <v-divider class="my-4" />

    <div class="text-subtitle-2 mb-2">{{ t('tools.qrcode-generate.options') }}</div>
    <v-row dense>
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model.number="size"
          type="number"
          min="64"
          max="1024"
          step="16"
          :label="t('tools.qrcode-generate.size')"
          density="comfortable"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-select
          v-model="ecLevel"
          :items="ecItems"
          :label="t('tools.qrcode-generate.ecLevel')"
          density="comfortable"
        />
      </v-col>
      <v-col cols="6" sm="6" md="3">
        <v-text-field v-model="fg" type="color" :label="t('tools.qrcode-generate.fgColor')" density="comfortable" />
      </v-col>
      <v-col cols="6" sm="6" md="3">
        <v-text-field v-model="bg" type="color" :label="t('tools.qrcode-generate.bgColor')" density="comfortable" />
      </v-col>
    </v-row>

    <v-alert v-if="error" type="error" variant="tonal" class="mt-2" :text="error" />

    <div class="d-flex flex-column align-center my-4">
      <div v-show="!payload" class="text-medium-emphasis pa-8">
        {{ t('tools.qrcode-generate.emptyHint') }}
      </div>
      <canvas v-show="payload" ref="canvasRef" class="qr-canvas" />
    </div>

    <div class="d-flex ga-2 flex-wrap justify-center">
      <v-btn color="primary" prepend-icon="mdi-download" :disabled="!payload" @click="download">
        {{ t('tools.qrcode-generate.downloadPng') }}
      </v-btn>
      <CopyBtn :text="payload" />
    </div>
  </ToolShell>
</template>

<style scoped>
.qr-canvas {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
}
</style>
