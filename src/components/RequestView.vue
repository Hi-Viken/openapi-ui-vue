<template>
  <div :class="['request-view', `request-layout-${effectiveLayout}`]" :style="{ '--request-split': `${split}%` }">
    <div class="request-pane">
      <header class="request-heading">
        <div>
          <div class="eyebrow">{{ operation.tags?.[0] || $t('request.requests') }}</div>
          <h1>{{ operation.summary || operation.operationId || operation.path }}</h1>
          <div class="auth-badges">
            <span :class="['auth-badge', authClass]" :title="authTitle">
              <LockOpen v-if="!auth.required" :size="12" />
              <ShieldAlert v-else-if="authDisabled || !auth.satisfied" :size="12" />
              <Lock v-else :size="12" />
              {{ authLabel }}
            </span>
          </div>
        </div>
        <div class="actions">
          <IconButton :label="favorite ? $t('request.removeFavorite') : $t('request.addFavorite')" :aria-pressed="favorite" @click="$emit('favorite')">
            <Star :size="18" :fill="favorite ? 'currentColor' : 'none'" />
          </IconButton>
          <IconButton v-if="auth.required" :class="{ 'needs-attention': !auth.satisfied }" :label="$t('request.configureAuth')" @click="$emit('auth')">
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
        <template v-else-if="tab === 'Headers'">
          <div v-if="authDisabled" class="muted auth-injected-note">
            <ShieldAlert :size="13" />
            {{ $t('request.authHeadersDisabled') }}
          </div>
          <div v-else-if="unresolvedHint" class="auth-injected-note is-error">
            <ShieldAlert :size="13" />
            {{ unresolvedHint }}
          </div>
          <div v-else-if="auth.required && !auth.satisfied" class="muted auth-injected-note">
            <ShieldAlert :size="13" />
            {{ $t('request.authMissingHint', { schemes: auth.missing.join(', ') || auth.schemes.join(', ') }) }}
          </div>
          <!-- 提示归提示，注入的实际内容照样展示：用户得看见"到底会发出什么" -->
          <div v-if="authHeaders.length" class="auth-injected">
            <p class="muted">
              {{ $t('request.authHeadersAuto') }}
              <span class="auth-injected-lock">({{ auth.schemes.join(', ') }})</span>
            </p>
            <div v-for="header in authHeaders" :key="header.name" class="auth-injected-row">
              <code>{{ header.name }}</code>
              <span class="auth-injected-value">{{ revealed ? header.value : mask(header.value) }}</span>
              <IconButton
                :label="revealed ? $t('request.hideValue') : $t('request.showValue')"
                @click="revealed = !revealed"
              >
                <EyeOff v-if="revealed" :size="15" />
                <Eye v-else :size="15" />
              </IconButton>
              <CopyButton :value="header.value" :notify="notify" />
            </div>
          </div>
          <KeyValueEditor
            :rows="draft.headers"
            :variables="variables"
            :output-definitions="outputDefinitions"
            @change="$emit('change', { headers: $event })"
            :add-label="$t('request.addHeader')"
          />
        </template>
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
        <CodeTools
          v-else-if="tab === 'Code'"
          embedded
          :spec="spec"
          :operation="operation"
          :draft="draft"
          :server="server"
          :variables="variables"
          :credentials="credentials"
          :notify="notify"
        />
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
import { ChevronRight, Columns2, Download, Eye, EyeOff, KeyRound, Lock, LockOpen, Plus, Rows2, ShieldAlert, Square, Star } from 'lucide-vue-next'
import IconButton from './ui/IconButton.vue'
import Method from './ui/Method.vue'
import VariableHelp from './ui/VariableHelp.vue'
import VariableInput from './ui/VariableInput.vue'
import KeyValueEditor from './ui/KeyValueEditor.vue'
import CodeEditor from './ui/CodeEditor.vue'
import CopyButton from './ui/CopyButton.vue'
import Markdown from './ui/Markdown.vue'
import PlayIcon from './ui/PlayIcon.vue'
import CodeTools from './tools/CodeTools.vue'
import {
  authHeader,
  authStatus,
  bodyExample,
  downloadBlob,
  exampleFor,
  resolveRef,
  resolvedAuth,
  credentialIssueMessages,
} from '@/lib/api'
import type { Credentials, Draft, Notify, OpenApiDocument, Operation, ResponseData, Variables, KeyValueRow } from '@/types'

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
  server?: string
  credentials?: Credentials
}>(), {
  variables: () => [],
  outputDefinitions: () => [],
  files: () => ({}),
  layout: 'stacked',
  split: 58,
  server: '',
  credentials: () => ({}),
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
  { key: 'Code', label: t('tools.code') },
  { key: 'Output variables', label: t('request.outputVariables') },
])

const responseTabs = computed(() => [
  { key: 'Body', label: t('request.responseBody') },
  { key: 'Headers', label: t('request.responseHeaders') },
  { key: 'Request', label: t('request.request') },
])

const effectiveLayout = computed(() => narrow.value ? 'stacked' : props.layout)

const auth = computed(() =>
  authStatus(props.operation, props.spec, props.credentials, props.variables, props.outputDefinitions)
)
const authDisabled = computed(() => props.draft?.authEnabled === false)

// 鉴权注入的请求头不进 draft.headers，以前用户在「请求头」页签里看不到它，
// 就以为令牌没带上。这里按 buildRequest 的同一套逻辑算出来，只读展示。
const authHeaders = computed(() =>
  authDisabled.value
    ? []
    : resolvedAuth(props.operation, props.credentials, props.spec, props.variables)
        .map(({ scheme, credential }) => authHeader(scheme, credential))
        .filter((header): header is { name: string; value: string } => !!header?.value)
)
const revealed = ref(false)

function mask(value: string): string {
  const match = /^(\S+)\s+(.+)$/.exec(value)
  if (!match) return '•'.repeat(Math.min(value.length, 24))
  const [, prefix, secret] = match
  if (secret.length <= 8) return `${prefix} ${'•'.repeat(secret.length)}`
  return `${prefix} ${secret.slice(0, 4)}${'•'.repeat(8)}${secret.slice(-4)}`
}

const authClass = computed(() => {
  if (!auth.value.required) return 'is-none'
  if (authDisabled.value) return 'is-disabled'
  return auth.value.satisfied ? 'is-ok' : 'is-missing'
})

const authLabel = computed(() => {
  if (!auth.value.required) return t('request.authNone')
  if (authDisabled.value) return t('request.authDisabled')
  if (auth.value.satisfied) return auth.value.schemes.join(' / ')
  if (auth.value.unresolved.length) return `${t('request.authRequired')} · {{${auth.value.unresolved.join(', ')}}}`
  return `${t('request.authRequired')} · ${t('auth.notConfigured')}`
})

const unresolvedHint = computed(() => {
  const messages: string[] = []
  for (const name of auth.value.schemes)
    for (const message of credentialIssueMessages(
      props.credentials?.[name],
      props.variables ?? [],
      props.outputDefinitions ?? [],
      t as any
    ))
      if (!messages.includes(message)) messages.push(message)
  return messages.join(' ')
})

const authTitle = computed(() => {
  if (unresolvedHint.value) return unresolvedHint.value
  if (auth.value.required && !auth.value.satisfied && auth.value.missing.length)
    return t('request.authMissingHint', { schemes: auth.value.missing.join(', ') })
  return authLabel.value
})

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
