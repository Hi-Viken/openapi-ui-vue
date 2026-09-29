<template>
  <div class="code-editor" :aria-label="label">
    <div v-if="ready && !offline" ref="editorContainer" class="code-editor-inner" />
    <textarea
      v-else
      :aria-label="label"
      :spellcheck="false"
      :readonly="readOnly"
      :value="value || ''"
      @input="onTextareaInput"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Variables, KeyValueRow } from '@/types'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  value?: string
  language?: string
  readOnly?: boolean
  label?: string
  variables?: Variables
  outputDefinitions?: KeyValueRow[]
}>(), {
  language: 'json',
  readOnly: false,
})

const emit = defineEmits<{ change: [value: string] }>()

const label = computed(() => props.label ?? t('ui.codeEditor'))

const ready = ref(false)
const offline = ref(false)
const editorContainer = ref<HTMLElement>()
let editorInstance: any = null
let monacoLib: any = null

const MONACO_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs'

const languageMap: Record<string, string> = {
  plaintext: 'plaintext',
  text: 'plaintext',
  json: 'json',
  xml: 'xml',
  shell: 'shell',
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  csharp: 'csharp',
  java: 'java',
  curl: 'shell',
}

const monacoLanguage = computed(() => languageMap[props.language] || props.language || 'plaintext')

function loadMonacoFromCDN(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((self as any).monaco) { resolve((self as any).monaco); return }
    const loaderScript = document.createElement('script')
    loaderScript.src = `${MONACO_CDN}/loader.js`
    loaderScript.onload = () => {
      const require = (self as any).require
      require.config({ paths: { vs: MONACO_CDN } })
      require(['vs/editor/editor.main'], () => {
        resolve((self as any).monaco)
      })
    }
    loaderScript.onerror = reject
    document.head.appendChild(loaderScript)
  })
}

onMounted(async () => {
  if (import.meta.env?.MODE === 'test') return
  const timeout = setTimeout(() => { offline.value = true }, 10000)
  try {
    monacoLib = await loadMonacoFromCDN()
    ready.value = true
    clearTimeout(timeout)
    await nextTick()
    createEditor()
  } catch {
    offline.value = true
    clearTimeout(timeout)
  }
})

function createEditor() {
  if (!monacoLib || !editorContainer.value) return
  if (editorInstance) {
    editorInstance.dispose()
    editorInstance = null
  }
  editorInstance = monacoLib.editor.create(editorContainer.value, {
    value: props.value || '',
    language: monacoLanguage.value,
    readOnly: props.readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    ariaLabel: props.label || label.value,
    padding: { top: 12 },
    tabSize: 2,
    theme: 'vs-dark',
    fixedOverflowWidgets: true,
  })
  if (!props.readOnly) {
    editorInstance.onDidChangeModelContent(() => {
      emit('change', editorInstance.getValue())
    })
  }
}

watch(() => props.value, (newVal) => {
  if (editorInstance) {
    const currentVal = editorInstance.getValue()
    const newValStr = newVal || ''
    if (currentVal !== newValStr) {
      editorInstance.setValue(newValStr)
    }
  }
})

watch(monacoLanguage, (lang) => {
  if (editorInstance && monacoLib) {
    monacoLib.editor.setModelLanguage(editorInstance.getModel(), lang)
  }
})

watch(() => props.readOnly, (ro) => {
  if (editorInstance) {
    editorInstance.updateOptions({ readOnly: ro })
  }
})

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose()
    editorInstance = null
  }
})

function onTextareaInput(event: Event) {
  emit('change', (event.target as HTMLTextAreaElement).value)
}
</script>

<style scoped>
.code-editor-inner {
  width: 100%;
  height: 100%;
  min-height: 200px;
}
</style>
