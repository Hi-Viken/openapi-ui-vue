<template>
  <div ref="shellRef" class="app-shell" :style="{ '--sidebar-width': `${sidebarWidth}px` }">
    <header class="app-header">
      <IconButton :label="$t('workspace.toggleCollections')" @click="sidebarOpen = !sidebarOpen">
        <Menu :size="19" />
      </IconButton>
      <a class="brand" href="#" @click.prevent="activate('overview')">
        <img class="brand-logo" :src="uiAssetUrl('openapi-ui.png')" :alt="$t('workspace.logo')" />
        <span>{{ $t('app.title') }}</span>
      </a>
      <a
        class="github-link"
        href="https://github.com/jakubkozera/openapi-ui"
        target="_blank"
        rel="noreferrer"
        :aria-label="$t('workspace.openOnGithub')"
        :title="$t('workspace.openOnGithub')"
      >
        <Github :size="19" />
      </a>
      <span class="header-divider" />
      <span class="header-title">{{ spec.info?.title || $t('workspace.collection') }}</span>
      <button class="text-button import-button" @click="$emit('import')">
        <Upload :size="15" />
        {{ $t('workspace.import') }}
      </button>
      <label v-if="!host" class="theme-picker">
        <span>{{ $t('workspace.theme') }}</span>
        <select :aria-label="$t('workspace.theme')" :value="theme" @change="onThemeChange">
          <option value="system">{{ $t('workspace.themes.system') }}</option>
          <option value="light">{{ $t('workspace.themes.light') }}</option>
          <option value="dark-plus">{{ $t('workspace.themes.darkPlus') }}</option>
          <option value="dark-modern">{{ $t('workspace.themes.darkModern') }}</option>
          <option value="graphite">{{ $t('workspace.themes.graphite') }}</option>
          <option value="github-light">{{ $t('workspace.themes.githubLight') }}</option>
          <option value="github-dark">{{ $t('workspace.themes.githubDark') }}</option>
          <option value="visual-studio-light">{{ $t('workspace.themes.vsLight') }}</option>
          <option value="visual-studio-dark">{{ $t('workspace.themes.vsDark') }}</option>
          <option value="contrast">{{ $t('workspace.themes.contrast') }}</option>
        </select>
      </label>
      <select class="locale-picker" :aria-label="$t('code.language')" :value="locale" @change="onLocaleChange">
        <option value="en">{{ $t('lang.en') }}</option>
        <option value="zh-CN">{{ $t('lang.zhCN') }}</option>
        <option value="zh-TW">{{ $t('lang.zhTW') }}</option>
      </select>
    </header>

    <nav class="activity-bar" :aria-label="$t('workspace.tools')">
      <button
        v-for="id in toolIds"
        :key="id"
        :title="$t(`tools.${id}`)"
        :aria-label="$t(`tools.${id}`)"
        :aria-current="view === id ? 'page' : undefined"
        @click="selectTool(id)"
      >
        <component :is="toolIcons[id]" :size="20" />
        <span>{{ $t(`tools.${id}`) }}</span>
      </button>
    </nav>

    <button
      v-if="sidebarOpen"
      class="sidebar-backdrop"
      :aria-label="$t('workspace.closeCollections')"
      @click="sidebarOpen = false"
    />

    <aside :class="['collection-sidebar', { 'is-open': sidebarOpen }]" :aria-label="$t('workspace.collectionNav')">
      <div class="sidebar-heading">
        <strong>{{ $t('workspace.collections') }}</strong>
        <IconButton :label="$t('app.importCollection')" @click="$emit('import')">
          <Upload :size="16" />
        </IconButton>
      </div>
      <div class="search-field">
        <Search :size="16" />
        <input
          :aria-label="$t('workspace.searchRequests')"
          v-model="search"
          :placeholder="$t('workspace.searchRequests')"
        />
        <IconButton v-if="search" :label="$t('workspace.clearSearch')" @click="search = ''">
          <X :size="14" />
        </IconButton>
      </div>
      <div class="sidebar-filters">
        <select :aria-label="$t('workspace.filterByMethod')" v-model="method">
          <option value="">{{ $t('workspace.allMethods') }}</option>
          <option v-for="m in METHODS" :key="m" :value="m">{{ m.toUpperCase() }}</option>
        </select>
        <IconButton
          :label="$t('workspace.showFavorites')"
          :aria-pressed="onlyFavorites"
          @click="onlyFavorites = !onlyFavorites"
        >
          <Star :size="16" :fill="onlyFavorites ? 'currentColor' : 'none'" />
        </IconButton>
      </div>
      <button
        :class="['collection-root', { selected: state.active === 'overview' && view === 'requests' }]"
        @click="activateOverview"
      >
        <ChevronDown :size="14" />
        <FolderOpen :size="17" />
        <span>{{ spec.info?.title || $t('workspace.collection') }}</span>
        <span class="count">{{ operations.length }}</span>
      </button>
      <div class="request-tree" ref="requestTreeRef">
        <details v-for="group in groups" :key="`${group}:${query}:${method}:${onlyFavorites}`" open>
          <summary>
            <ChevronRight class="expand-chevron" :size="14" />
            {{ group }}
            <span>{{ filtered.filter((item) => (item.tags?.[0] || $t('workspace.requests')) === group).length }}</span>
          </summary>
          <button
            v-for="item in filtered.filter((i) => (i.tags?.[0] || $t('workspace.requests')) === group)"
            :key="item.id"
            :class="['tree-request', { selected: state.active === item.id }]"
            :title="`${item.method.toUpperCase()} ${item.path}`"
            @click="openOperation(item)"
          >
            <Method :method="item.method" />
            <span>{{ item.summary || item.path }}</span>
            <Star v-if="state.favorites.includes(item.id)" :size="12" />
          </button>
        </details>
        <p v-if="filtered.length === 0" class="empty">{{ $t('workspace.noMatchingRequests') }}</p>
      </div>
      <footer class="sidebar-footer">
        <span class="status-dot" />
        {{ operations.length }} {{ $t('workspace.requests').toLowerCase() }}
        <span>v{{ spec.info?.version || '1.0' }}</span>
      </footer>
    </aside>

    <div
      class="sidebar-resizer"
      role="separator"
      :aria-label="$t('workspace.resizeSidebar')"
      aria-orientation="vertical"
      :aria-valuemin="0"
      :aria-valuemax="MAX_SIDEBAR_WIDTH"
      :aria-valuenow="sidebarWidth"
      tabindex="0"
      @dblclick="toggleSidebarWidth"
      @keydown="onResizerKeydown"
      @pointerdown="onResizerPointerDown"
    />

    <main class="workspace-main">
      <div class="request-tabs" role="tablist" :aria-label="$t('workspace.openRequests')" @keydown="onTabKeydown">
        <button
          role="tab"
          :aria-selected="state.active === 'overview' && view === 'requests'"
          @click="activate('overview')"
        >
          <House :size="15" />
          {{ $t('workspace.overview') }}
        </button>
        <div
          v-for="tab in state.tabs"
          :key="tab.id"
          :class="['request-tab', { active: state.active === tab.id && view === 'requests' }]"
          @contextmenu.prevent="onTabContextMenu($event, tab.id)"
        >
          <button
            role="tab"
            :aria-selected="state.active === tab.id && view === 'requests'"
            @click="activate(tab.id)"
            :title="`${getOperation(tab.id)?.method.toUpperCase()} ${getOperation(tab.id)?.path}`"
          >
            <Method :method="getOperation(tab.id)?.method || ''" />
            <span>{{ getOperation(tab.id)?.summary || getOperation(tab.id)?.path }}</span>
            <span v-if="pending[tab.id]" class="pending-dot" />
          </button>
          <IconButton :label="`${$t('workspace.close')} ${getOperation(tab.id)?.summary || getOperation(tab.id)?.path}`" @click="closeTabs([tab.id], { type: 'close', id: tab.id })">
            <X :size="14" />
          </IconButton>
        </div>
      </div>

      <RequestTabContextMenu
        v-if="contextMenu"
        :tabs="state.tabs"
        :tab-id="contextMenu.id"
        :x="contextMenu.x"
        :y="contextMenu.y"
        @close="contextMenu = null"
        :is-favorite="state.favorites.includes(contextMenu.id)"
        @favorite="handleFavorite"
        @add-to-runner="handleAddToRunner"
        @action="handleContextMenuAction"
      />

      <div class="server-bar">
        <div class="server-label">
          <span class="status-dot" />
          {{ $t('workspace.server') }}
          <VariableInput
            :aria-label="$t('workspace.serverUrl')"
            :variables="state.variables"
            list="server-options"
            :model-value="server"
            @update:model-value="onServerChange"
          />
        </div>
        <datalist id="server-options">
          <option
            v-for="(item, index) in operation?.servers || spec.servers || []"
            :key="`${item.url}:${index}`"
            :value="getServerUrl({ servers: [item] }, source, defaultServer)"
          >
            {{ item.description }}
          </option>
        </datalist>
      </div>

      <p v-if="storageFailed" role="alert" class="error-banner">
        {{ $t('workspace.storageError') }}
      </p>

      <div
        v-if="savedRequest && operation && savedRequest.operationId === operation.id && view === 'requests'"
        class="saved-request-bar"
      >
        <span>{{ $t('workspace.editingSaved') }}</span>
        <button @click="saveToCollection">{{ $t('workspace.saveToCollection') }}</button>
      </div>

      <div class="workspace-content">
        <RequestView
          v-if="view === 'requests' && active && operation"
          :key="operation.id"
          :operation="operation"
          :spec="spec"
          :draft="active.draft"
          :variables="state.variables"
          :output-definitions="outputDefinitions"
          @change="onDraftChange"
          @send="send"
          @cancel="cancelRequest"
          :response="responses[operation.id]"
          :pending="pending[operation.id]"
          :favorite="state.favorites.includes(operation.id)"
          @favorite="dispatch({ type: 'favorite', id: operation.id })"
          @add-to-collection="addToRunner"
          :notify="notify"
          :files="files[operation.id] || {}"
          @file="onFile"
          @auth="view = 'auth'"
          :layout="requestLayout"
          :split="requestSplit"
          @update:layout="requestLayout = $event"
          @update:split="requestSplit = $event"
        />
        <Overview
          v-else-if="view === 'requests'"
          :spec="spec"
          :operations="operations"
          @open="openOperation"
          @runner="handleRunnerFromOverview"
        />
        <Variables
          v-else-if="view === 'variables'"
          :variables="state.variables"
          @change="onVariablesChange"
        />
        <History
          v-else-if="view === 'history'"
          :history="state.history"
          @open="onHistoryOpen"
          @clear="dispatch({ type: 'update', patch: { history: [] } })"
        />
        <Authorization
          v-else-if="view === 'auth'"
          :spec="spec"
          :credentials="credentials"
          @change="onCredentialsChange"
          :workspace="key"
          :remember="remember"
          @update:remember="remember = $event"
          :notify="notify"
          :operation="operation"
          :enabled="active?.draft.authEnabled"
          @update:enabled="onAuthEnabled"
        />
        <Runner
          v-else-if="view === 'runner'"
          :collections="state.collections"
          @change="onCollectionsChange"
          :operations="operations"
          @open="openOperation"
          :execute="execute"
          :variables="state.variables"
          :notify="notify"
        />
        <CodeTools
          v-else-if="view === 'code'"
          :spec="spec"
          :operation="operation"
          :draft="active?.draft"
          :server="server"
          :variables="state.variables"
          :credentials="credentials"
          :notify="notify"
        />
      </div>

      <footer class="workspace-status">
        <span>
          {{ view === 'requests'
            ? active && operation
              ? `${operation.method.toUpperCase()} ${operation.path}`
              : $t('workspace.collectionOverview')
            : $t(`tools.${view}`) }}
        </span>
        <span>{{ state.tabs.length }} {{ $t('workspace.openTabs') }}</span>
        <span>{{ storageFailed ? $t('workspace.notSaved') : $t('workspace.sessionSaved') }}</span>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Code2,
  FolderOpen,
  Github,
  History as HistoryIcon,
  House,
  KeyRound,
  Menu,
  PlayIcon,
  Search,
  Star,
  Upload,
  X,
} from 'lucide-vue-next'
import IconButton from './ui/IconButton.vue'
import Method from './ui/Method.vue'
import VariableInput from './ui/VariableInput.vue'
import RequestView from './RequestView.vue'
import RequestTabContextMenu from './RequestTabContextMenu.vue'
import Overview from './tools/Overview.vue'
import Variables from './tools/Variables.vue'
import History from './tools/History.vue'
import Authorization from './Authorization.vue'
import Runner from './Runner.vue'
import CodeTools from './tools/CodeTools.vue'
import { useWorkspace } from '@/composables/useWorkspace'
import { persistWorkspace } from '@/lib/workspace'
import {
  buildRequest,
  extractOutputs,
  getOperations,
  makeDraft,
  METHODS,
  serverUrl as getServerUrl,
  sendRequest,
} from '@/lib/api'
import { completeAuthorization } from '@/lib/oauth'
import { readJson } from '@/lib/platform'
import type {
  Credentials,
  Draft,
  Notify,
  OpenApiDocument,
  Operation,
  ResponseData,
  RequestCollection,
  SavedRequest,
  StorageLike,
  Variables as VariableList,
} from '@/types'

const toolIds = ['requests', 'history', 'variables', 'auth', 'runner', 'code'] as const
const toolIcons: Record<string, any> = {
  requests: FolderOpen,
  history: HistoryIcon,
  variables: Braces,
  auth: KeyRound,
  runner: PlayIcon,
  code: Code2,
}

const SIDEBAR_WIDTH_KEY = 'openapi-ui:sidebar-width'
const REQUEST_LAYOUT_KEY = 'openapi-ui:request-layout'
const REQUEST_SPLIT_KEY = 'openapi-ui:request-split'
const DEFAULT_SIDEBAR_WIDTH = 280
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 520

function storedNumber(storage: StorageLike, key: string, fallback: number): number {
  const stored = storage.getItem(key)
  if (stored === null) return fallback
  const value = Number(stored)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function uiAssetUrl(asset: string): string {
  const uiPath = location.pathname.replace(/\/+$/, '')
  return `${uiPath}/${asset}`
}

const props = defineProps<{
  spec: OpenApiDocument
  source: string
  storage: StorageLike
  theme: string
  notify: Notify
}>()

const emit = defineEmits<{
  'update:theme': [theme: string]
  import: []
}>()

const operations = computed(() => getOperations(props.spec) as Operation[])
const { state, dispatch, active, key } = useWorkspace(
  props.storage,
  props.source,
  props.spec,
  operations.value
)

const view = ref('requests')
const search = ref('')
const deferredSearch = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { deferredSearch.value = val }, 150)
})
const method = ref('')
const onlyFavorites = ref(false)
const sidebarOpen = ref(false)
const sidebarWidth = ref(storedNumber(props.storage, SIDEBAR_WIDTH_KEY, DEFAULT_SIDEBAR_WIDTH))
const requestLayout = ref<'stacked' | 'columns'>(
  props.storage.getItem(REQUEST_LAYOUT_KEY) === 'columns' ? 'columns' : 'stacked'
)
const requestSplit = ref(Math.min(80, Math.max(20, storedNumber(props.storage, REQUEST_SPLIT_KEY, 58))))

const shellRef = ref<HTMLDivElement>()
const requestTreeRef = ref<HTMLDivElement>()

const responses = ref<Record<string, ResponseData>>({})
const pending = ref<Record<string, boolean>>({})
const files = ref<Record<string, Record<string, File | undefined>>>({})
const savedRequest = ref<SavedRequest | null>(null)
const contextMenu = ref<{ id: string; x: number; y: number } | null>(null)
const storageFailed = ref(false)

const controllers = new Map<string, AbortController>()
const sessionCredentials = ref(`${key}:credentials`)
const remember = ref(!!readJson(props.storage, sessionCredentials.value, null))
const credentials = ref<Credentials>(readJson(props.storage, sessionCredentials.value, {}))

const operation = computed(() => operations.value.find((item) => item.id === state.value.active))

const rawBase = document.querySelector<HTMLMetaElement>('meta[name="openapi-base-url"]')?.content
const defaultServer = computed(() =>
  getServerUrl(
    operation.value?.servers ? { ...props.spec, servers: operation.value.servers } : props.spec,
    props.source,
    rawBase && !rawBase.startsWith('#')
      ? rawBase
      : /^https?:/.test(location.origin)
        ? location.origin
        : 'http://localhost'
  )
)
const server = computed(() => state.value.server ?? defaultServer.value)

const query = computed(() => deferredSearch.value.toLowerCase().trim())
const filtered = computed(() =>
  operations.value.filter(
    (item) =>
      (!method.value || item.method === method.value) &&
      (!onlyFavorites.value || state.value.favorites.includes(item.id)) &&
      `${item.method} ${item.path} ${item.summary || ''} ${item.operationId || ''} ${(item.tags || []).join(' ')}`
        .toLowerCase()
        .includes(query.value)
  )
)
const groups = computed(() => [...new Set(filtered.value.map((item) => item.tags?.[0] || 'Requests'))])

const outputDefinitions = computed(() => [
  ...state.value.tabs.flatMap((tab: { draft: Draft }) => tab.draft.outputs || []),
  ...state.value.collections.flatMap((collection: RequestCollection) =>
    collection.requests.flatMap((request) => request.draft.outputs || [])
  ),
])

const host = computed(() => !!window.openapiHost || document.body.className.includes('vscode-'))

function getOperation(id: string): Operation | undefined {
  return operations.value.find((item) => item.id === id)
}

function selectTool(id: string) {
  view.value = id
  sidebarOpen.value = false
}

function activate(id: string) {
  dispatch({ type: 'activate', id })
  view.value = 'requests'
  sidebarOpen.value = false
}

function activateOverview() {
  activate('overview')
  toggleCollectionSections()
}

function toggleCollectionSections() {
  const sections = Array.from(requestTreeRef.value?.querySelectorAll('details') || [])
  const shouldExpand = sections.some((section) => !section.open)
  sections.forEach((section) => {
    section.open = shouldExpand
  })
}

function openOperation(item?: Operation, draft?: Draft, saved?: SavedRequest) {
  if (!item) {
    props.notify(t('notify.operationRemoved'), true)
    return
  }
  dispatch({ type: 'open', id: item.id, draft: draft || makeDraft(item, props.spec) })
  if (draft) dispatch({ type: 'draft', id: item.id, patch: draft })
  savedRequest.value = saved ? { ...saved, operationId: item.id } : null
  view.value = 'requests'
  sidebarOpen.value = false
}

function closeTabs(ids: string[], action: { type: string; id: string }) {
  if (!ids.length) return
  ids.forEach((id) => controllers.get(id)?.abort())
  dispatch(action)
  const nextResponses = { ...responses.value }
  const nextPending = { ...pending.value }
  const nextFiles = { ...files.value }
  ids.forEach((id) => {
    delete nextResponses[id]
    delete nextPending[id]
    delete nextFiles[id]
  })
  responses.value = nextResponses
  pending.value = nextPending
  files.value = nextFiles
}

function addTabToRunner(tabId: string) {
  const tab = state.value.tabs.find((item: any) => item.id === tabId)
  const tabOperation = operations.value.find((item) => item.id === tabId)
  if (!tab || !tabOperation) return
  const collection = state.value.collections[0] || {
    id: crypto.randomUUID(),
    name: props.spec.info?.title || 'Collection',
    requests: [],
    delay: 0,
  }
  const request = {
    id: crypto.randomUUID(),
    operationId: tabOperation.id,
    draft: structuredClone(tab.draft),
    enabled: true,
  }
  const updated = { ...collection, requests: [...collection.requests, request] }
  dispatch({
    type: 'update',
    patch: {
      collections: state.value.collections.length
        ? state.value.collections.map((item: any) => (item.id === collection.id ? updated : item))
        : [updated],
    },
  })
  props.notify(t('notify.addedToCollection', { name: collection.name }))
}

function addToRunner() {
  if (operation.value && state.value.active) addTabToRunner(operation.value.id)
}

async function execute(
  item: Operation,
  draft: Draft,
  variables: VariableList,
  signal: AbortSignal,
  requestFiles: Record<string, File | undefined> = {}
): Promise<{ response: ResponseData; variables: VariableList }> {
  let response: ResponseData
  const started = performance.now()
  try {
    const request = buildRequest(item, draft, server.value, variables, credentials.value, props.spec, requestFiles)
    response = await sendRequest(request, signal)
    response.request = `${item.method.toUpperCase()} ${request.url}\n${[...(request.options.headers as any)].map(([name, value]: [string, string]) => `${name}: ${/authorization|cookie|key|token|secret/i.test(name) ? '[redacted]' : value}`).join('\n')}`
  } catch (error) {
    if ((error instanceof DOMException && error.name === 'AbortError') || signal.aborted)
      throw new DOMException('Request cancelled', 'AbortError')
    const message = error instanceof Error ? error.message : String(error)
    const isNetworkError = message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('CORS') || message.includes('Network request failed')
    response = {
      ok: false,
      status: 0,
      statusText: isNetworkError ? 'Network / CORS Error' : 'Request failed',
      body: isNetworkError
        ? `⚠️ ${message}\n\nPossible causes:\n• The server is not reachable\n• CORS policy blocked the request — the server must allow origin: ${location.origin}\n• Mixed content (HTTPS page requesting HTTP resource)\n• Invalid SSL certificate\n\nTo fix CORS, configure the server to send:\n  Access-Control-Allow-Origin: ${location.origin}\n  Access-Control-Allow-Methods: *\n  Access-Control-Allow-Headers: *`
        : message,
      headers: {},
      duration: Math.round(performance.now() - started),
      size: 0,
      corsError: isNetworkError,
    }
  }
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
  responses.value = { ...responses.value, [item.id]: response }
  dispatch({
    type: 'history',
    entry: {
      id: crypto.randomUUID(),
      operationId: item.id,
      method: item.method,
      path: item.path,
      status: response.status,
      duration: response.duration,
      at: new Date().toISOString(),
    },
  })
  let nextVariables = variables
  if (response.ok) {
    try {
      nextVariables = extractOutputs(draft.outputs, response.body || '', variables)
      if (nextVariables !== variables) dispatch({ type: 'update', patch: { variables: nextVariables } })
    } catch (error) {
        props.notify(t('notify.outputExtractionFailed', { error: error instanceof Error ? error.message : String(error) }), true)
    }
  }
  return { response, variables: nextVariables }
}

async function send(requestFiles: Record<string, File | undefined>) {
  if (!operation.value || !state.value.active) return
  const id = operation.value.id
  if (controllers.has(id)) return
  const controller = new AbortController()
  controllers.set(id, controller)
  pending.value = { ...pending.value, [id]: true }
  try {
    await execute(operation.value, active.value!.draft, state.value.variables, controller.signal, requestFiles)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') props.notify(t('notify.requestCancelled'))
    else props.notify(error instanceof Error ? error.message : String(error), true)
  } finally {
    controllers.delete(id)
    pending.value = { ...pending.value, [id]: false }
  }
}

function cancelRequest() {
  if (operation.value) controllers.get(operation.value.id)?.abort()
}

function onThemeChange(event: Event) {
  emit('update:theme', (event.target as HTMLSelectElement).value)
}

const { locale, t } = useI18n()
function onLocaleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  locale.value = value
  localStorage.setItem('openapi-ui:locale', value)
}

function onServerChange(value: string) {
  dispatch({ type: 'update', patch: { server: value } })
}

function onDraftChange(patch: Draft) {
  if (operation.value) dispatch({ type: 'draft', id: operation.value.id, patch })
}

function onFile(name: string, file: File | undefined) {
  if (!operation.value) return
  files.value = {
    ...files.value,
    [operation.value.id]: { ...files.value[operation.value.id], [name]: file },
  }
}

function onVariablesChange(variables: VariableList) {
  dispatch({ type: 'update', patch: { variables } })
}

function onCollectionsChange(collections: RequestCollection[]) {
  dispatch({ type: 'update', patch: { collections } })
}

function onCredentialsChange(credentials: Credentials) {
  credentials.value = credentials
}

function onAuthEnabled(authEnabled: boolean) {
  if (operation.value) dispatch({ type: 'draft', id: operation.value.id, patch: { authEnabled } })
}

function onHistoryOpen(id: string) {
  openOperation(operations.value.find((item) => item.id === id))
}

function handleRunnerFromOverview() {
  if (!state.value.collections.length) {
    dispatch({
      type: 'update',
      patch: {
        collections: [
          {
            id: crypto.randomUUID(),
            name: props.spec.info?.title || 'Collection',
            requests: operations.value.map((item) => ({
              id: crypto.randomUUID(),
              operationId: item.id,
              draft: makeDraft(item, props.spec),
              enabled: true,
            })),
            delay: 0,
          },
        ],
      },
    })
  }
  view.value = 'runner'
}

function saveToCollection() {
  if (!savedRequest.value || !active.value) return
  dispatch({
    type: 'update',
    patch: {
      collections: state.value.collections.map((collection: any) =>
        collection.id === savedRequest.value!.collectionId
          ? {
              ...collection,
              requests: collection.requests.map((request: any) =>
                request.id === savedRequest.value!.requestId
                  ? { ...request, draft: structuredClone(active.value.draft) }
                  : request
              ),
            }
          : collection
      ),
    },
  })
  props.notify(t('notify.collectionUpdated'))
}

function onTabContextMenu(event: MouseEvent, id: string) {
  contextMenu.value = { id, x: event.clientX, y: event.clientY }
}

function handleFavorite() {
  if (contextMenu.value) {
    dispatch({ type: 'favorite', id: contextMenu.value.id })
    contextMenu.value = null
  }
}

function handleAddToRunner() {
  if (contextMenu.value) {
    addTabToRunner(contextMenu.value.id)
    contextMenu.value = null
  }
}

function handleContextMenuAction(action: string, ids: string[]) {
  closeTabs(ids, { type: action, id: contextMenu.value!.id })
  contextMenu.value = null
}

function toggleSidebarWidth() {
  sidebarWidth.value = sidebarWidth.value === 0 ? DEFAULT_SIDEBAR_WIDTH : 0
}

function onResizerKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') sidebarWidth.value = DEFAULT_SIDEBAR_WIDTH
  else {
    const next = sidebarWidth.value + (event.key === 'ArrowRight' ? 20 : -20)
    sidebarWidth.value = next < MIN_SIDEBAR_WIDTH ? 0 : Math.min(MAX_SIDEBAR_WIDTH, next)
  }
}

function onResizerPointerDown(event: PointerEvent) {
  event.preventDefault()
  const resize = (moveEvent: PointerEvent) => {
    const shellLeft = shellRef.value?.getBoundingClientRect().left || 0
    const activityWidth = window.innerWidth <= 1100 ? 62 : 70
    const next = moveEvent.clientX - shellLeft - activityWidth
    sidebarWidth.value =
      next < 140 ? 0 : Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, next))
  }
  const stop = () => {
    window.removeEventListener('pointermove', resize)
    window.removeEventListener('pointerup', stop)
  }
  window.addEventListener('pointermove', resize)
  window.addEventListener('pointerup', stop)
}

function onTabKeydown(event: KeyboardEvent) {
  const current = event.target as HTMLElement
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || current.getAttribute('role') !== 'tab')
    return
  const tabs = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const index = tabs.indexOf(current as HTMLButtonElement)
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  event.preventDefault()
  tabs[target].focus()
  tabs[target].click()
}

watch(sidebarWidth, (width) => {
  try {
    props.storage.setItem(SIDEBAR_WIDTH_KEY, String(width))
  } catch {}
})

watch([requestLayout, requestSplit], ([layout, split]) => {
  try {
    props.storage.setItem(REQUEST_LAYOUT_KEY, layout)
    props.storage.setItem(REQUEST_SPLIT_KEY, String(split))
  } catch {}
})

watch([credentials, remember], () => {
  try {
    if (remember.value) props.storage.setItem(sessionCredentials.value, JSON.stringify(credentials.value))
    else props.storage.removeItem(sessionCredentials.value)
  } catch {
    props.notify(t('notify.credentialsSaveFailed'), true)
  }
})

watch(
  state,
  () => {
    storageFailed.value = !persistWorkspace(props.storage, key, state.value)
  },
  { deep: true }
)

onMounted(() => {
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'workspaceSaveError') storageFailed.value = true
  }
  window.addEventListener('message', onMessage)

  completeAuthorization(location.href)
    .then((result) => {
      if (!result) return
      if (result.workspace !== key) {
        props.notify(t('notify.oauthWrongCollection'), true)
        return
      }
      credentials.value = { ...credentials.value, [result.scheme]: result.credential }
      history.replaceState(null, '', location.pathname)
      props.notify(t('notify.authCompleted'))
    })
    .catch((error) => props.notify(error.message, true))

  const navigate = () => {
    let hash
    try {
      hash = decodeURIComponent(location.hash.slice(1))
    } catch {
      return
    }
    const match = operations.value.find(
      (item) =>
        `${item.method}-${item.path}` === hash ||
        `${item.method}-${item.path.replace(/[{}]/g, '')}` === hash
    )
    if (match) openOperation(match)
  }
  navigate()
  window.addEventListener('hashchange', navigate)

  onUnmounted(() => {
    window.removeEventListener('message', onMessage)
    window.removeEventListener('hashchange', navigate)
    controllers.forEach((controller) => controller.abort())
  })
})
</script>
