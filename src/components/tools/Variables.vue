<template>
  <section class="tool-view">
    <header class="section-heading">
      <h1>{{ $t('variables.title') }}</h1>
      <VariableHelp />
      <span class="count">{{ variables.length }}</span>
    </header>
    <p class="empty">
      {{ $t('variables.description') }} <code v-pre>{{variableName}}</code>
    </p>
    <KeyValueEditor :rows="variables" @change="$emit('change', $event)" :add-label="$t('variables.addVariable')" />
  </section>
</template>

<script setup lang="ts">
import VariableHelp from '../ui/VariableHelp.vue'
import KeyValueEditor from '../ui/KeyValueEditor.vue'
import type { Variables } from '@/types'

defineProps<{ variables: Variables }>()
defineEmits<{ change: [variables: Variables] }>()
</script>
