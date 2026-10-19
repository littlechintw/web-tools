<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import type { QRCodeErrorCorrectionLevel } from 'qrcode'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'
import { isNumber, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { downloadText, downloadUrl } from '@/utils/download'

const TOOL_ID = 'qrcode-generate'
const { t } = useI18n()
const T = (key: string) => t(`tools.${TOOL_ID}.${key}`)

type ContentType = 'text' | 'wifi' | 'vcard'
type Encryption = 'WPA' | 'WEP' | 'nopass'

interface SavedData {
  type: ContentType
  text: string
  ssid: string
  password: string
  encryption: Encryption
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
const encryption = ref<Encryption>('WPA')
const wifiHidden = ref(false)
const name = ref('')
const phone = ref('')
const email = ref('')
const org = ref('')

// Appearance options are remembered between visits; the content is not.
const EC_LEVELS = ['L', 'M', 'Q', 'H'] as const
const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const size = useStoredRef('qrcode-generate.size', 256, isNumber)
const ecLevel = useStoredRef<QRCodeErrorCorrectionLevel>('qrcode-generate.ecLevel', 'M', oneOf(EC_LEVELS))
const fg = useStoredRef('qrcode-generate.fg', '#000000', isHexColor)
const bg = useStoredRef('qrcode-generate.bg', '#ffffff', isHexColor)

const canvasRef = ref<HTMLCanvasElement>()
const error = ref('')

/** Escape WiFi/vCard reserved characters. */
function escapeWifi(s: string): string {
  return s.replace(/([\;,:"])/g, '\\$1')
}
function escapeVcard(s: string): string {
  return s.replace(/([\;,])/g, '\\$1').replace(/\n/g, '\\n')
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

// The size field can be emptied mid-edit; render with a sane value anyway.
const sizePx = computed(() => Math.min(1024, Math.max(64, Math.round(Number(size.value) || 256))))

const renderOptions = computed(() => ({
  width: sizePx.value,
  errorCorrectionLevel: ecLevel.value,
  margin: 2,
  color: { dark: fg.value, light: bg.value },
}))

async function render() {
  await nextTick()
  const el = canvasRef.value
  if (!el) return
  const data = payload.value
  const ctx = el.getContext('2d')
  if (!data) {
    el.width = sizePx.value
    el.height = sizePx.value
    ctx?.clearRect(0, 0, el.width, el.height)
    error.value = ''
    return
  }
  try {
    await QRCode.toCanvas(el, data, renderOptions.value)
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

/** A filename stem that hints at the content: "qrcode-example-com", "qrcode-wifi-Home". */
function fileBase(): string {
  const raw =
    type.value === 'wifi' ? `wifi-${ssid.value}` : type.value === 'vcard' ? `vcard-${name.value || phone.value}` : text.value
  const slug = raw
    .replace(/^https?:\/\//i, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug ? `qrcode-${slug}` : 'qrcode'
}

function downloadPng() {
  const el = canvasRef.value
  if (!el || !payload.value) return
  downloadUrl(el.toDataURL('image/png'), `${fileBase()}.png`)
}

async function downloadSvg() {
  if (!payload.value) return
  try {
    const svg = await QRCode.toString(payload.value, { ...renderOptions.value, type: 'svg' })
    downloadText(svg, `${fileBase()}.svg`, 'image/svg+xml;charset=utf-8')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function snapshot(): SavedData {
  return {
    type: type.value,
    text: text.value,
    ssid: ssid.value,
    // never persist Wi-Fi passwords to localStorage history
    password: '',
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

history.restoreFromRoute((d) => {
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
})

onMounted(() => render())

const typeItems = computed(() => [
  { title: T('typeText'), value: 'text' },
  { title: T('typeWifi'), value: 'wifi' },
  { title: T('typeVcard'), value: 'vcard' },
])
// Error-correction level with the share of damage each one can recover from.
const ecItems = [
  { title: 'L (7%)', value: 'L' },
  { title: 'M (15%)', value: 'M' },
  { title: 'Q (25%)', value: 'Q' },
  { title: 'H (30%)', value: 'H' },
]
const encItems = computed(() => [
  { title: 'WPA/WPA2', value: 'WPA' },
  { title: 'WEP', value: 'WEP' },
  { title: T('encNone'), value: 'nopass' },
])
</script>

<template>
  <ToolShell>
    <v-select v-model="type" :items="typeItems" :label="T('contentType')" density="comfortable" class="mb-2" />

    <!-- Text / URL -->
    <template v-if="type === 'text'">
      <v-textarea v-model="text" :label="T('text')" rows="3" auto-grow clearable />
    </template>

    <!-- WiFi -->
    <template v-else-if="type === 'wifi'">
      <v-text-field v-model="ssid" :label="T('ssid')" density="comfortable" />
      <v-text-field
        v-model="password"
        :label="T('password')"
        :disabled="encryption === 'nopass'"
        density="comfortable"
        autocomplete="off"
      />
      <v-select v-model="encryption" :items="encItems" :label="T('encryption')" density="comfortable" />
      <v-checkbox v-model="wifiHidden" :label="T('wifiHidden')" hide-details density="compact" />
    </template>

    <!-- vCard -->
    <template v-else>
      <v-text-field v-model="name" :label="T('name')" density="comfortable" />
      <v-text-field v-model="phone" :label="T('phone')" density="comfortable" />
      <v-text-field v-model="email" :label="T('email')" density="comfortable" />
      <v-text-field v-model="org" :label="T('org')" density="comfortable" />
    </template>

    <v-divider class="my-4" />

    <div class="text-subtitle-2 mb-2">{{ T('options') }}</div>
    <v-row density="comfortable">
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model.number="size"
          type="number"
          min="64"
          max="1024"
          step="16"
          :label="T('size')"
          density="comfortable"
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-select v-model="ecLevel" :items="ecItems" :label="T('ecLevel')" density="comfortable" hide-details />
      </v-col>
      <v-col cols="6" sm="6" md="3">
        <v-text-field v-model="fg" type="color" :label="T('fgColor')" density="comfortable" hide-details />
      </v-col>
      <v-col cols="6" sm="6" md="3">
        <v-text-field v-model="bg" type="color" :label="T('bgColor')" density="comfortable" hide-details />
      </v-col>
    </v-row>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4" :text="error" />

    <div class="d-flex flex-column align-center my-4">
      <div v-show="!payload" class="text-medium-emphasis pa-8">
        {{ T('emptyHint') }}
      </div>
      <canvas v-show="payload" ref="canvasRef" class="qr-canvas" />
    </div>

    <div class="d-flex ga-2 flex-wrap justify-center">
      <v-btn color="primary" prepend-icon="mdi-download" :disabled="!payload" @click="downloadPng">
        {{ T('downloadPng') }}
      </v-btn>
      <v-btn variant="tonal" prepend-icon="mdi-vector-curve" :disabled="!payload" @click="downloadSvg">
        {{ T('downloadSvg') }}
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
