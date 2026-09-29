<template>
  <div :class="['request-view', `request-layout-${effectiveLayout}`]" :style="{ '--request-split': `${split}%` }">
    <div class="request-pane">
      <header class="request-heading">
        <div>
          <div class="eyebrow">{{ operation.tags?.[0] || $t('request.requests') }}</div>
          <h1>{{ operation.summary || operation.operationId || operation.path }}</h1>
        </div>
        <div class="actions">
          <IconButton :label="favorite ? $t('request.removeFavorite') : $t('request.addFavorite')" :aria-pressed="favorite" @click="$emit('favorite')">
            <Star :size="18" :fill="favorite ? 'currentColor' : 'none'" />
          </IconButton>
          <IconButton v-if="operation.security.length > 0" :label="$t('request.configureAuth')" @click="$emit('auth')">
            <KeyRound :size="18" />
          </IconButton>
          <IconButton :label="$t('request.addToRunner')" @click="$emit('add-to-collection')">
            <Plus :size="19" />
          </IconButton>
        </div>
      </header>
      <form class="request-url" @submit.prevent="$emit('send', files)">
        <Method :method="operation.method" />
        <VariableHelp />
        <VariableInput
          :aria-label="$t('request.requestPath')"
          :variables="variables"
          :output-definitions="outputDefinitions"
          :model-value="draft.path || ''"
          @update:model-value="$emit('change', { path: $event })"
        />
        <button v-if="pending" type="button" class="primary" @click="$emit('cancel')">
          <Square :size="15" />
          {{ $t('request.cancel') }}
        </button>
        <button v-else type="submit" class="primary">
          <PlayIcon :size="16" />
          {{ $t('request.send') }}
        </button>
      </form>
      <div class="subtabs" role="tablist" :aria-label="$t('request.requestDetails')">
        <button
          v-for="name in requestTabs"
          :key="name.key"
          role="tab"
          :aria-selected="tab === name.key"
          @click="tab = name.key"
        >
          {{ name.label }}
          <span v-if="name.key === 'Parameters' && draft.parameters?.length > 0" class="count">{{ draft.parameters.length }}</span>
        </button>
      </div>
      <section class="request-details" role="tabpanel" :aria-label="tab">
        <KeyValueEditor
          v-if="tab === 'Parameters'"
          :rows="draft.parameters"
          :variables="variables"
          :output-definitions="outputDefinitions"
          @change="$emit('change', { parameters: $event })"
          locations
          :add-label="$t('request.addParameter')"
        />
        <KeyValueEditor
          v-else-if="tab === 'Headers'"
          :rows="draft.headers"
          :variables="variables"
          :output-definitions="outputDefinitions"
          @change="$emit('change', { headers: $event })"
          :add-label="$t('request.addHeader')"
        />
        <template v-else-if="tab === 'Body'">
          <div class="body-toolbar">
            <label>
              {{ $t('request.contentType') }}
              <select :aria-label="$t('request.contentType')" :value="draft.contentType || ''" @change="onContentTypeChange">
                <option value="">{{ $t('request.none') }}</option>
                <option v-for="type in allContentTypes" :key="type">{{ type }}</option>
              </select>
            </label>
            <VariableHelp />
            <button class="text-button" @click="resetBody">{{ $t('request.resetExample') }}</button>
          </div>
          <KeyValueEditor
            v-if="['multipart/form-data', 'application/x-www-form-urlencoded'].includes(draft.contentType)"
            :rows="draft.form"
            :variables="variables"
            :output-definitions="outputDefinitions"
            @change="$emit('change', { form: $event })"
            :files="draft.contentType === 'multipart/form-data'"
            :on-file="(name, file) => $emit('file', name, file)"
            :add-label="$t('request.addField')"
          />
          <CodeEditor
            v-else
            :label="$t('request.requestBody')"
            :variables="variables"
            :output-definitions="outputDefinitions"
            :value="draft.body"
            @change="$emit('change', { body: $event })"
            :language="bodyLanguage"
          />
        </template>
        <div v-else-if="tab === 'Documentation'" class="documentation">
          <Markdown>{{ operation.description || operation.summary }}</Markdown>
          <p v-if="operation.deprecated" class="warning">{{ $t('request.deprecated') }}</p>
          <div v-for="param in operation.parameters" :key="`${param.in}:${param.name}`" class="parameter-doc">
            <strong>{{ param.name }}</strong>
            <code>{{ param.in }}</code>
            <span v-if="param.required" class="required">{{ $t('request.required') }}</span>
            <Markdown>{{ param.description }}</Markdown>
            <pre>{{ JSON.stringify(param.schema || param, null, 2) }}</pre>
          </div>
          <details v-if="operation.requestBody">
            <summary>
              <ChevronRight class="expand-chevron" :size="14" />
              {{ $t('request.requestSchema') }}
            </summary>
            <pre>{{ JSON.stringify(operation.requestBody, null, 2) }}</pre>
          </details>
          <details v-for="(value, status) in operation.responses || {}" :key="status">
            <summary>
              <ChevronRight class="expand-chevron" :size="14" />
              <strong>{{ status }}</strong> {{ resolveRef(value, spec).description }}
            </summary>
            <pre>{{ JSON.stringify(getResponseExample(value, status), null, 2) }}</pre>
            <pre v-if="getResponseSchema(value)">{{ JSON.stringify(getResponseSchema(value), null, 2) }}</pre>
          </details>
        </div>
        <KeyValueEditor
          v-else-if="tab === 'Output variables'"
          :rows="draft.outputs"
          @change="$emit('change', { outputs: $event })"
          outputs
          :value-label="$t('request.jsonpath')"
          :add-label="$t('request.addOutputVariable')"
        />
      </section>
    </div>
    <div
      class="request-resizer"
      role="separator"
      :aria-label="$t('request.resizePanels')"
      :aria-orientation="effectiveLayout === 'columns' ? 'vertical' : 'horizontal'"
      aria-valuemin="20"
      aria-valuemax="80"
      :aria-valuenow="Math.round(split)"
      tabindex="0"
      @dblclick="$emit('update:split', 58)"
      @keydown="onResizerKeydown"
      @pointerdown="onResizerPointerDown"
    />
    <section class="response-section" :aria-label="$t('request.response')">
      <header class="response-heading">
        <h2>{{ $t('request.response') }}</h2>
        <span v-if="pending" role="status">{{ $t('request.sendingRequest') }}</span>
        <div class="response-meta">
          <template v-if="response">
            <strong :class="response.ok ? 'success' : 'error-text'">
              <span v-if="response.corsError">⚠️</span>
              {{ response.status || '✖' }} {{ response.statusText }}
            </strong>
            <span>{{ response.duration }} ms</span>
            <span v-if="response.size">{{ response.size.toLocaleString() }} B</span>
            <IconButton v-if="response.blob" :label="$t('request.downloadResponse')" @click="downloadResponse">
              <Download :size="16" />
            </IconButton>
            <CopyButton :value="response.body || ''" :notify="notify" />
          </template>
          <span class="response-layout-toggle">
            <IconButton
              :label="layout === 'stacked' ? $t('request.sideBySide') : $t('request.stacked')"
              @click="$emit('update:layout', layout === 'stacked' ? 'columns' : 'stacked')"
            >
              <Columns2 v-if="layout === 'stacked'" :size="15" />
              <Rows2 v-else :size="15" />
            </IconButton>
          </span>
        </div>
      </header>
      <div v-if="!response && !pending" class="response-empty">
        <PlayIcon :size="28" />
        <span>{{ $t('request.noResponseYet') }}</span>
      </div>
      <template v-if="response">
        <div class="subtabs" role="tablist" :aria-label="$t('request.responseDetails')">
          <button v-for="name in responseTabs" :key="name.key" role="tab" :aria-selected="responseTab === name.key" @click="responseTab = name.key">
            {{ name.label }}
          </button>
        </div>
        <template v-if="responseTab === 'Body'">
          <img v-if="preview" class="response-image" :src="preview" :alt="$t('request.apiResponse')" />
          <div v-else-if="response.corsError" class="cors-error-banner">
            <pre style="white-space: pre-wrap; line-height: 1.8; padding: 16px; color: var(--error);">{{ response.body }}</pre>
          </div>
          <p v-else-if="response.binary" class="empty">{{ $t('request.binaryResponse') }} ({{ response.contentType }})</p>
          <CodeEditor
            v-else
            :label="$t('request.responseBody')"
            read-only
            :value="response.body"
            :language="response.contentType?.includes('json') ? 'json' : 'plaintext'"
          />
        </template>
        <dl v-else-if="responseTab === 'Headers'" class="response-headers">
          <div v-for="(value, name) in response.headers || {}" :key="name">
            <dt>{{ name }}</dt>
            <dd>{{ String(value) }}</dd>
          </div>
        </dl>
        <pre v-else-if="responseTab === 'Request'">{{ response.request }}</pre>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, Columns2, Download, KeyRound, Plus, Rows2, Square, Star } from 'lucide-vue-next'
import IconButton from './ui/IconButton.vue'
import Method from './ui/Method.vue'
import VariableHelp from './ui/VariableHelp.vue'
import VariableInput from './ui/VariableInput.vue'
import KeyValueEditor from './ui/KeyValueEditor.vue'
import CodeEditor from './ui/CodeEditor.vue'
import CopyButton from './ui/CopyButton.vue'
import Markdown from './ui/Markdown.vue'
import PlayIcon from './ui/PlayIcon.vue'
import { bodyExample, downloadBlob, exampleFor, resolveRef } from '@/lib/api'
import type { Draft, Notify, OpenApiDocument, Operation, ResponseData, Variables, KeyValueRow } from '@/types'

const props = withDefaults(defineProps<{
  operation: Operation
  spec: OpenApiDocument
  draft: Draft
  variables?: Variables
  outputDefinitions?: KeyValueRow[]
  response?: ResponseData
  pending?: boolean
  favorite?: boolean
  notify?: Notify
  files?: Record<string, File | undefined>
  layout?: 'stacked' | 'columns'
  split?: number
}>(), {
  variables: () => [],
  outputDefinitions: () => [],
  files: () => ({}),
  layout: 'stacked',
  split: 58,
})

const emit = defineEmits<{
  change: [patch: Draft]
  send: [files: Record<string, File | undefined>]
  cancel: []
  favorite: []
  'add-to-collection': []
  file: [name: string, file: File | undefined]
  auth: []
  'update:layout': [layout: 'stacked' | 'columns']
  'update:split': [split: number]
}>()

const { t } = useI18n()

const tab = ref('Parameters')
const responseTab = ref('Body')
const preview = ref('')
const narrow = ref(window.matchMedia?.('(max-width: 820px)').matches ?? false)

const requestTabs = computed(() => [
  { key: 'Parameters', label: t('request.parameters') },
  { key: 'Headers', label: t('request.headers') },
  { key: 'Body', label: t('request.body') },
  { key: 'Documentation', label: t('request.documentation') },
  { key: 'Output variables', label: t('request.outputVariables') },
])

const responseTabs = computed(() => [
  { key: 'Body', label: t('request.responseBody') },
  { key: 'Headers', label: t('request.responseHeaders') },
  { key: 'Request', label: t('request.request') },
])

const effectiveLayout = computed(() => narrow.value ? 'stacked' : props.layout)

const contentTypes = computed(() => Object.keys(props.operation.requestBody?.content || {}))
const allContentTypes = computed(() => [
  ...new Set([
    ...contentTypes.value,
    'application/json',
    'text/plain',
    'application/xml',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  ]),
])

const bodyLanguage = computed(() => {
  if (props.draft.contentType?.includes('json')) return 'json'
  if (props.draft.contentType?.includes('xml')) return 'xml'
  return 'plaintext'
})

function onContentTypeChange(event: Event) {
  const contentType = (event.target as HTMLSelectElement).value
  const schema = resolveRef(props.operation.requestBody?.content?.[contentType]?.schema, props.spec)
  emit('change', {
    contentType,
    body: bodyExample(props.operation, props.spec, contentType),
    form: Object.entries(schema.properties || {}).map(([name, value]: [string, any]) => ({
      name,
      value: value.default ?? '',
      enabled: true,
      file: value.format === 'binary' || value.type === 'file',
    })),
  })
}

function resetBody() {
  emit('change', { body: bodyExample(props.operation, props.spec, props.draft.contentType) })
}

function getResponseExample(value: any, _status: any) {
  const responseSpec = resolveRef(value, props.spec)
  const media: any = Object.values(responseSpec.content || {})[0]
  return media?.example ?? (media?.schema || responseSpec.schema
    ? exampleFor(media?.schema || responseSpec.schema, props.spec)
    : responseSpec)
}

function getResponseSchema(value: any) {
  const responseSpec = resolveRef(value, props.spec)
  const media: any = Object.values(responseSpec.content || {})[0]
  return media?.schema || null
}

function downloadResponse() {
  if (!props.response?.blob) return
  downloadBlob(
    props.response.blob,
    props.response.headers?.['content-disposition']?.match(/filename="?([^";]+)/)?.[1] || 'response'
  )
}

function onResizerKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') { emit('update:split', 58); return }
  const decrease = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
  emit('update:split', Math.min(80, Math.max(20, props.split + (decrease ? -2 : 2))))
}

function onResizerPointerDown(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('button')) return
  event.preventDefault()
  const container = (event.currentTarget as HTMLElement).parentElement
  const resize = (moveEvent: PointerEvent) => {
    if (!container) return
    const bounds = container.getBoundingClientRect()
    const position = effectiveLayout.value === 'columns'
      ? moveEvent.clientX - bounds.left
      : moveEvent.clientY - bounds.top
    const total = effectiveLayout.value === 'columns' ? bounds.width : bounds.height
    emit('update:split', Math.min(80, Math.max(20, (position / total) * 100)))
  }
  const stop = () => {
    window.removeEventListener('pointermove', resize)
    window.removeEventListener('pointerup', stop)
  }
  window.addEventListener('pointermove', resize)
  window.addEventListener('pointerup', stop)
}

watch(() => props.response, (newResponse) => {
  if (!newResponse?.blob || !newResponse.contentType?.startsWith('image/')) {
    preview.value = ''
    return
  }
  preview.value = URL.createObjectURL(newResponse.blob)
}, { immediate: true })

onMounted(() => {
  const media = window.matchMedia?.('(max-width: 820px)')
  const update = () => { narrow.value = window.innerWidth <= 820 }
  media?.addEventListener('change', update)
  window.addEventListener('resize', update)
  onUnmounted(() => {
    media?.removeEventListener('change', update)
    window.removeEventListener('resize', update)
  })
})
</script>
