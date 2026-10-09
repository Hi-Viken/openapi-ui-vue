<template>
  <section :class="['code-tools', embedded ? 'code-tools-inline' : 'tool-view']">
    <header class="section-heading">
      <h1 v-if="!embedded">{{ $t('code.title') }}</h1>
      <div class="actions">
        <CopyButton :value="code" :notify="notify" />
        <IconButton :label="$t('code.download')" :disabled="!code" @click="downloadCode">
          <Download :size="17" />
        </IconButton>
      </div>
    </header>
    <div class="subtabs" role="tablist" :aria-label="$t('code.generation')">
      <button
        v-for="item in modeTabs"
        :key="item.key"
        role="tab"
        :aria-selected="mode === item.key"
        :disabled="item.key === 'Request snippet' && !operation"
        @click="mode = item.key; language = 'javascript'"
      >
        {{ item.label }}
      </button>
    </div>
    <div class="code-options">
      <label>
        {{ $t('code.language') }}
        <select :aria-label="$t('code.language')" v-model="language">
          <option v-for="item in languages" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
      <template v-if="mode === 'API client'">
        <label>
          {{ $t('code.className') }}
          <input v-model="name" />
        </label>
        <label>
          {{ $t('code.namespace') }}
          <input v-model="namespace" />
        </label>
      </template>
    </div>
    <details v-if="mode === 'API client'">
      <summary>
        <ChevronRight class="expand-chevron" :size="14" />
        {{ $t('code.generatorOptions') }}
      </summary>
      <div class="generator-options">
        <label v-for="(value, key) in generatorOptions" :key="String(key)" class="check-label">
          <input v-if="typeof value === 'boolean'" type="checkbox" :checked="value" @change="toggleOption(String(key))" />
          <select v-else :value="value" @change="setOption(String(key), ($event.target as HTMLSelectElement).value)">
            <option>fetch</option>
            <option>axios</option>
          </select>
          {{ formatOptionKey(String(key)) }}
        </label>
      </div>
    </details>
    <p v-if="error" role="alert" class="error-banner">{{ error }}</p>
    <template v-else>
      <div v-if="Object.keys(files).length > 1" class="subtabs" role="tablist" :aria-label="$t('code.generatedFiles')">
        <button
          v-for="key in Object.keys(files).filter((k) => files[k])"
          :key="key"
          role="tab"
          :aria-selected="selectedFile === key"
          @click="selectedFile = key"
        >
          {{ key }}
        </button>
      </div>
      <CodeEditor
        :label="$t('code.generatedCode')"
        :value="code"
        read-only
        :language="language === 'curl' ? 'shell' : language"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, Download } from 'lucide-vue-next'
import IconButton from '../ui/IconButton.vue'
import CopyButton from '../ui/CopyButton.vue'
import CodeEditor from '../ui/CodeEditor.vue'
import { buildRequest, downloadBlob } from '@/lib/api'
import { CodeSnippetGenerator } from '@/lib/codeSnippets'
import { JavaScriptApiGenerator } from '@/lib/generators/javascriptApiClientGenerator'
import { CSharpApiGenerator } from '@/lib/generators/csharpApiClientGenerator'
import type { Credentials, Draft, Notify, OpenApiDocument, Operation, Variables } from '@/types'

const props = defineProps<{
  spec: OpenApiDocument
  operation?: Operation
  draft?: Draft
  server?: string
  variables: Variables
  credentials?: Credentials
  notify?: Notify
  embedded?: boolean
}>()

const { t } = useI18n()

const modeTabs = computed(() => [
  { key: 'Request snippet', label: t('code.requestSnippet') },
  { key: 'API client', label: t('code.apiClient') },
])

const mode = ref(props.operation ? 'Request snippet' : 'API client')
const language = ref('javascript')
const options = ref<Record<string, Record<string, any>>>({})
const name = ref('ApiClient')
const namespace = ref('ApiClient')
const selectedFile = ref('')

const snippetGenerator = new CodeSnippetGenerator()

const generatorOptions = computed(() => {
  const gen = language.value === 'csharp' ? new CSharpApiGenerator(options.value.csharp) : new JavaScriptApiGenerator(options.value.javascript)
  return gen.options as Record<string, any>
})

const generateError = ref('')

const files = computed<Record<string, string>>(() => {
  generateError.value = ''
  try {
    if (mode.value === 'Request snippet' && props.operation) {
      const request = buildRequest(props.operation, props.draft, props.server || '', props.variables, props.credentials || {}, props.spec)
      const body = request.options.body instanceof URLSearchParams
        ? request.options.body.toString()
        : typeof request.options.body === 'string' ? request.options.body : ''
      return { snippet: snippetGenerator.generateSnippet(language.value, props.operation.method, request.url, body, Object.fromEntries(request.options.headers as any)) }
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name.value) || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(namespace.value))
      throw new Error('Use valid identifiers for client and namespace names.')
    return generateApiClient()
  } catch (failure) {
    generateError.value = failure instanceof Error ? failure.message : String(failure)
    return {}
  }
})

const selected = computed(() => files.value[selectedFile.value] ? selectedFile.value : Object.keys(files.value).find((key) => files.value[key]) || '')
const code = computed(() => files.value[selected.value] || '')
const error = computed(() => generateError.value)

const languages = computed(() =>
  mode.value === 'API client'
    ? [{ id: 'javascript', name: 'JavaScript / TypeScript' }, { id: 'csharp', name: 'C#' }]
    : snippetGenerator.getSupportedLanguages()
)

watch(() => Object.keys(files.value)[0], (first) => { if (first && !files.value[selectedFile.value]) selectedFile.value = first })

function generateApiClient(): Record<string, string> {
  const GenClass = language.value === 'csharp' ? CSharpApiGenerator : JavaScriptApiGenerator
  const gen = new GenClass(options.value[language.value])
  gen.loadFromSwaggerData(props.spec)
  const result = gen.generateClient(namespace.value, name.value) as Record<string, string | null>
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(result)) {
    if (value) output[key] = value
  }
  return output
}

function formatOptionKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1')
}

function toggleOption(key: string) {
  options.value = { ...options.value, [language.value]: { ...options.value[language.value], [key]: !options.value[language.value]?.[key] } }
}

function setOption(key: string, value: string) {
  options.value = { ...options.value, [language.value]: { ...options.value[language.value], [key]: value } }
}

function downloadCode() {
  if (!code.value) return
  const ext = language.value === 'csharp' ? 'cs' : language.value === 'python' ? 'py' : language.value === 'java' ? 'java' : language.value === 'curl' ? 'sh' : options.value.javascript?.generateTypeScript ? 'ts' : 'js'
  downloadBlob(new Blob([code.value], { type: 'text/plain' }), `${selected.value}.${ext}`)
}
</script>
