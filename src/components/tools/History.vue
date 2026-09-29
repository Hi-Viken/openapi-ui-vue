<template>
  <section class="tool-view">
    <header class="section-heading">
      <h1>{{ $t('history.title') }}</h1>
      <IconButton :label="$t('history.clear')" @click="$emit('clear')">
        <Trash2 :size="17" />
      </IconButton>
    </header>
    <p v-if="!history.length" class="empty">{{ $t('history.empty') }}</p>
    <button
      v-for="entry in history"
      :key="entry.id"
      class="history-row"
      @click="$emit('open', entry.operationId)"
    >
      <Method :method="entry.method" />
      <div>
        <code>{{ entry.path }}</code>
        <span>{{ new Date(entry.at).toLocaleString() }}</span>
      </div>
      <span :class="entry.status >= 200 && entry.status < 400 ? 'success' : 'error-text'">
        {{ entry.status || $t('history.error') }}
      </span>
      <span class="muted">{{ entry.duration }} ms</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import IconButton from '../ui/IconButton.vue'
import Method from '../ui/Method.vue'
import { Trash2 } from 'lucide-vue-next'

defineProps<{ history: any[] }>()
defineEmits<{ open: [id: string]; clear: [] }>()
</script>
