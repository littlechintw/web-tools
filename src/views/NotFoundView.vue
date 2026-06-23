<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <v-container class="py-16">
    <v-empty-state
      icon="mdi-tools"
      :headline="'404'"
      :title="t('notFound.title')"
      :text="t('notFound.message')"
    >
      <template #actions>
        <v-btn color="primary" to="/" prepend-icon="mdi-home">{{ t('notFound.backHome') }}</v-btn>
      </template>
    </v-empty-state>
  </v-container>
</template>
