<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { LANGS, searchStatus, STATUS_CLASSES, STATUS_CODES, type Lang, type StatusClass } from '@/lib/httpStatus'

const TOOL_ID = 'http-status'
const { t, locale } = useI18n()
const T = (key: string, named?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, named ?? {})

const query = ref('')
const cls = ref<StatusClass | null>(null)

const lang = computed<Lang>(() => (LANGS.includes(locale.value as Lang) ? (locale.value as Lang) : 'en'))
const results = computed(() => searchStatus(STATUS_CODES, query.value, cls.value))

const COLORS: Record<StatusClass, string> = { 1: 'info', 2: 'success', 3: 'primary', 4: 'warning', 5: 'error' }
</script>

<template>
  <ToolShell>
    <v-text-field
      v-model="query"
      :label="T('search')"
      prepend-inner-icon="mdi-magnify"
      clearable
      hide-details
      density="comfortable"
      autocomplete="off"
    />
    <div class="d-flex flex-wrap ga-2 mt-3 align-center">
      <v-chip :variant="cls === null ? 'flat' : 'outlined'" color="primary" @click="cls = null">{{ T('all') }}</v-chip>
      <v-chip
        v-for="c in STATUS_CLASSES"
        :key="c"
        :variant="cls === c ? 'flat' : 'outlined'"
        :color="COLORS[c]"
        @click="cls = cls === c ? null : c"
      >
        <span class="tabular-nums">{{ c }}xx</span>&nbsp;{{ T(`class${c}`) }}
      </v-chip>
    </div>
    <p class="text-caption text-medium-emphasis mt-2 mb-0">{{ T('count', { n: results.length }) }}</p>

    <v-alert v-if="!results.length" type="info" variant="tonal" density="compact" class="mt-3">{{ T('noResults') }}</v-alert>
    <v-row density="comfortable" class="mt-1">
      <v-col v-for="s in results" :key="s.code" cols="12" md="6">
        <v-card variant="outlined" class="h-100">
          <v-card-text class="d-flex ga-3">
            <div class="text-h6 font-weight-bold tabular-nums" :class="`text-${COLORS[s.cls]}`" style="min-width: 3.2rem">{{ s.code }}</div>
            <div style="min-width: 0">
              <div class="font-weight-medium break-all">{{ s.name }}</div>
              <div class="text-body-2 mt-1">{{ s.meaning[lang] }}</div>
              <div class="text-caption text-medium-emphasis mt-2">
                <span class="font-weight-medium">{{ T('when') }}</span>{{ s.when[lang] }}
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </ToolShell>
</template>
