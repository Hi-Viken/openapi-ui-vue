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
    <section v-if="servers.length || metaRows.length" class="spec-meta">
      <header class="section-heading">
        <h2>{{ $t('overview.apiInfo') }}</h2>
      </header>
      <div v-if="servers.length" class="meta-block">
        <h3>{{ $t('overview.servers') }}</h3>
        <ul class="server-list">
          <li v-for="(item, index) in servers" :key="`${item.url}:${index}`">
            <code>{{ item.url }}</code>
            <span v-if="item.description" class="muted">{{ item.description }}</span>
          </li>
        </ul>
      </div>
      <dl v-if="metaRows.length" class="meta-grid">
        <template v-for="row in metaRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>
            <a v-if="row.href" :href="row.href" target="_blank" rel="noreferrer">{{ row.value }}</a>
            <template v-else>{{ row.value }}</template>
          </dd>
        </template>
      </dl>
    </section>
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
      <details v-for="group in groups" :key="group">
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
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, FileCode2 } from 'lucide-vue-next'
import Method from '../ui/Method.vue'
import Markdown from '../ui/Markdown.vue'
import PlayIcon from '../ui/PlayIcon.vue'
import type { Operation, OpenApiDocument } from '@/types'

const props = defineProps<{ spec: OpenApiDocument; operations: Operation[] }>()
defineEmits<{ open: [operation: Operation]; runner: [] }>()

const { t } = useI18n()

const groups = computed(() => [
  ...new Set(props.operations.flatMap((op) => op.tags?.length ? op.tags : ['Requests'])),
])

const servers = computed(() => {
  const list = (props.spec.servers || []).filter((item: any) => item?.url)
  if (list.length) return list
  return props.spec.host
    ? [{ url: `${props.spec.schemes?.[0] || 'https'}://${props.spec.host}${props.spec.basePath || ''}` }]
    : []
})

const metaRows = computed(() => {
  const info = props.spec.info || {}
  const contact = info.contact || {}
  const license = info.license || {}
  const docs = props.spec.externalDocs || {}
  const rows: { label: string; value: string; href?: string }[] = []
  if (contact.name) rows.push({ label: t('overview.contact'), value: contact.name })
  if (contact.url) rows.push({ label: t('overview.docsUrl'), value: contact.url, href: contact.url })
  if (contact.email)
    rows.push({ label: t('overview.email'), value: contact.email, href: `mailto:${contact.email}` })
  if (info.termsOfService)
    rows.push({ label: t('overview.terms'), value: info.termsOfService, href: info.termsOfService })
  if (license.name)
    rows.push({ label: t('overview.license'), value: license.name, href: license.url })
  else if (license.url)
    rows.push({ label: t('overview.license'), value: license.url, href: license.url })
  if (docs.url)
    rows.push({ label: t('overview.externalDocs'), value: docs.description || docs.url, href: docs.url })
  return rows
})
</script>
