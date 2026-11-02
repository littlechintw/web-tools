<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const sections = ['input', 'storage', 'analytics', 'ads', 'external', 'contact'] as const
</script>

<template>
  <v-container style="max-width: 760px" class="py-6">
    <h1 class="text-h5 mb-1">{{ t('privacyPage.title') }}</h1>
    <p class="text-caption text-medium-emphasis mb-4">{{ t('privacyPage.updated') }}</p>
    <p class="mb-6">{{ t('privacyPage.intro') }}</p>
    <section v-for="s in sections" :key="s" class="mb-5">
      <h2 class="text-subtitle-1 font-weight-bold mb-1">{{ t(`privacyPage.sections.${s}.title`) }}</h2>
      <p>{{ t(`privacyPage.sections.${s}.body`) }}</p>
    </section>
  </v-container>
</template>
