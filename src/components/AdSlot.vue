<script setup lang="ts">
/**
 * One fixed-size AdSense placement (small, at the bottom of the page, never
 * fixed to the screen). Usage: <AdSlot location="home" :slot-id="AD_SLOTS.home" />
 * Renders nothing in production unless ADSENSE_CLIENT and the slot id are set.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ADSENSE_CLIENT, adsEnabled } from '@/config/ads'
import { loadAdSense } from '@/utils/adsense'

const props = defineProps<{ slotId: string; location: string }>()
const { t } = useI18n()

const enabled = computed(() => adsEnabled(props.slotId))
const showDevPlaceholder = import.meta.env.DEV
const insEl = ref<HTMLElement | null>(null)
// Never send real ad requests from a local machine: use AdSense test mode there.
const isLocal = typeof location !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)

onMounted(async () => {
  if (!enabled.value) return
  try {
    await loadAdSense(ADSENSE_CLIENT)
    // An <ins> can only be filled once; each mount is a fresh element.
    if (!insEl.value || insEl.value.dataset.adsbygoogleStatus) return
    ;(window.adsbygoogle = window.adsbygoogle || ([] as unknown as NonNullable<Window['adsbygoogle']>)).push({})
  } catch (error) {
    // Almost always an ad blocker: stay silent, nothing else depends on it.
    console.debug('[ads]', props.location, error instanceof Error ? error.message : error)
  }
})
</script>

<template>
  <div
    v-if="enabled || showDevPlaceholder"
    class="ad-slot d-flex flex-column align-center ga-1 px-4 pt-2 pb-3"
    role="complementary"
    :aria-label="t('ads.label')"
  >
    <span class="ad-slot-label text-medium-emphasis" aria-hidden="true">{{ t('ads.label') }}</span>
    <!-- Fixed size (no data-ad-format): CSS media query picks it, so no layout shift. -->
    <ins
      v-if="enabled"
      ref="insEl"
      class="adsbygoogle ad-slot-unit"
      style="display: inline-block"
      :data-ad-client="ADSENSE_CLIENT"
      :data-ad-slot="slotId"
      :data-adtest="isLocal ? 'on' : undefined"
    ></ins>
    <div v-else class="ad-slot-unit ad-slot-dev-box text-medium-emphasis">
      AdSense「{{ location }}」(not configured — renders nothing in production)
    </div>
  </div>
</template>

<style scoped>
.ad-slot-label {
  font-size: 0.66rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
/* 320×50 on phones (smallest standard banner), 728×90 on desktop; fixed height. */
.ad-slot-unit {
  width: 320px;
  height: 50px;
  max-width: 100%;
}
@media (min-width: 820px) {
  .ad-slot-unit {
    width: 728px;
    height: 90px;
  }
}
/* No fill: hide the whole slot, label included, instead of leaving an empty box. */
.ad-slot:has(ins.adsbygoogle[data-ad-status='unfilled']) {
  display: none;
}
.ad-slot-dev-box {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1rem;
  text-align: center;
  font-size: 0.74rem;
  border: 1px dashed currentColor;
  border-radius: 6px;
}
</style>
