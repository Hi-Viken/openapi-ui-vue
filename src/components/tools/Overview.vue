<template>
  <section class="overview">
    <div class="eyebrow">{{ $t('overview.title') }}</div>
    <header class="overview-heading">
      <div>
        <h1>{{ spec.info?.title || $t('overview.untitled') }}</h1>
        <div class="collection-meta">
          <span>{{ String(spec.info?.version || '1.0').replace(/^v?/, 'v') }}</span>
          <span>OpenAPI {{ spec.openapi || spec.swagger }}</span>
          <span v-if="spec.info?.license?.name">{{ spec.info.license.name }}</span>
        </div>
      </div>
      <button class="primary" @click="$emit('runner')">
        <PlayIcon :size="16" />
        {{ $t('overview.runCollection') }}
      </button>
    </header>
    <Markdown>{{ spec.info?.description }}</Markdown>
    <div class="collection-stats">
      <div>
        <strong>{{ operations.length }}</strong>
        <span>{{ $t('overview.requests') }}</span>
      </div>
      <div>
        <strong>{{ groups.length }}</strong>
        <span>{{ $t('overview.groups') }}</span>
      </div>
      <div>
        <strong>{{ Object.keys(spec.components?.schemas || spec.definitions || {}).length }}</strong>
        <span>{{ $t('overview.schemas') }}</span>
      </div>
    </div>
    <section class="endpoint-list">
      <header class="section-heading">
        <h2>{{ $t('overview.requests') }}</h2>
        <span class="muted">{{ operations.length }} {{ $t('overview.operations') }}</span>
      </header>
      <details v-for="group in groups" :key="group" open>
        <summary>
          <ChevronRight class="expand-chevron" :size="14" />
          {{ group }}
          <span class="count">{{ operations.filter((op) => (op.tags || ['Requests']).includes(group)).length }}</span>
        </summary>
        <button
          v-for="operation in operations.filter((op) => (op.tags?.length ? op.tags : ['Requests']).includes(group))"
          :key="operation.id"
          class="endpoint-row"
          @click="$emit('open', operation)"
        >
          <Method :method="operation.method" />
          <code>{{ operation.path }}</code>
          <span>{{ operation.summary }}</span>
        </button>
      </details>
    </section>
    <section v-if="Object.entries(spec.components?.schemas || spec.definitions || {}).length > 0" class="schemas">
      <h2>{{ $t('overview.schemas') }}</h2>
      <details v-for="[name, schema] in Object.entries(spec.components?.schemas || spec.definitions || {})" :key="name">
        <summary>
          <ChevronRight class="expand-chevron" :size="14" />
          <FileCode2 :size="16" />
          {{ name }}
        </summary>
        <pre>{{ JSON.stringify(schema, null, 2) }}</pre>
      </details>
    </section>
    <footer v-if="spec.info?.contact" class="collection-contact">
      {{ spec.info.contact.name }}
      <a v-if="spec.info.contact.email" :href="`mailto:${spec.info.contact.email}`">{{ spec.info.contact.email }}</a>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, FileCode2 } from 'lucide-vue-next'
import Method from '../ui/Method.vue'
import Markdown from '../ui/Markdown.vue'
import PlayIcon from '../ui/PlayIcon.vue'
import type { Operation, OpenApiDocument } from '@/types'

const props = defineProps<{ spec: OpenApiDocument; operations: Operation[] }>()
defineEmits<{ open: [operation: Operation]; runner: [] }>()

const groups = computed(() => [
  ...new Set(props.operations.flatMap((op) => op.tags?.length ? op.tags : ['Requests'])),
])
</script>
