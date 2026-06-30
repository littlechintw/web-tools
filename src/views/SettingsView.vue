<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()
const settings = useSettingsStore()
</script>

<template>
  <v-container max-width="640" class="py-8">
    <h1 class="text-h5 font-weight-bold mb-6">{{ t('settings.title') }}</h1>

    <v-card rounded="lg" variant="outlined">
      <v-list>
        <v-list-item :subtitle="t('settings.analytics.description')">
          <template #title>
            <span class="font-weight-medium">{{ t('settings.analytics.title') }}</span>
          </template>
          <template #append>
            <v-switch
              :model-value="settings.analyticsEnabled"
              color="primary"
              hide-details
              inset
              @update:model-value="settings.setAnalyticsEnabled($event as boolean)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card>
  </v-container>
</template>
