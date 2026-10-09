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
import { variableReferences } from '@/lib/api'
import { referenceDescription } from '@/lib/variableText'
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
let decorations: any = null

const MONACO_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs'

// loader.js 全局只能注入一次。以前每个 CodeEditor 实例各自 onMounted 判断
// `self.monaco` —— 那时 AMD 还没加载完所以恒为 undefined，于是并发挂载会重复插 script，
// 第二次直接抛 `Identifier '_amdLoaderGlobal' has already been declared`，连带
// 第一个的 require 回调失败，页面上所有 Monaco 编辑器一起变只读框。
// 整份约定 promise 共用，同时也是"加载失败后可重试"。
let monacoLoaderPromise: Promise<any> | null = null

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
  if (!monacoLoaderPromise) {
    monacoLoaderPromise = new Promise<any>((resolve, reject) => {
      if ((self as any).monaco) {
        resolve((self as any).monaco)
        return
      }
      const loaderScript = document.createElement('script')
      loaderScript.src = `${MONACO_CDN}/loader.js`
      loaderScript.onload = () => {
        const require = (self as any).require
        if (!require) {
          reject(new Error('Monaco AMD loader did not initialize.'))
          return
        }
        require.config({ paths: { vs: MONACO_CDN } })
        require(['vs/editor/editor.main'], () => resolve((self as any).monaco))
      }
      loaderScript.onerror = () => reject(new Error('Failed to load Monaco loader.'))
      document.head.appendChild(loaderScript)
    })
    monacoLoaderPromise.catch(() => {
      monacoLoaderPromise = null
    })
  }
  return monacoLoaderPromise
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
  decorations = editorInstance.createDecorationsCollection()
  if (!props.readOnly) {
    editorInstance.onDidChangeModelContent(() => {
      emit('change', editorInstance.getValue())
      applyVariableDecorations()
    })
  }
  applyVariableDecorations()
}

/**
 * 把编辑器里的 {{{name}}} 变量引用按解析状态上色 + 挂悬停提示，
 * 让 raw body 和 form 字段一样"看得见变量会不会生效"。
 * 缺省（offline textarea 降级模式）不画。
 */
function applyVariableDecorations() {
  if (!editorInstance || !monacoLib || !decorations) return
  const model = editorInstance.getModel()
  if (!model) return
  const text = model.getValue()
  const refs = props.variables
    ? variableReferences(text, props.variables, props.outputDefinitions)
    : []
  if (!refs.length) {
    decorations.clear()
    return
  }
  decorations.set(
    refs.map((ref: any) => {
      const start = model.getPositionAt(ref.start)
      const end = model.getPositionAt(ref.end)
      return {
        range: new monacoLib.Range(start.lineNumber, start.column, end.lineNumber, end.column),
        options: {
          inlineClassName: `var-${ref.status}`,
          hoverMessage: { value: referenceDescription(ref, t) },
        },
      }
    })
  )
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

// 变量表 / 输出变量定义变了，重新上色（模型内容没变，onDidChangeModelContent 不会触发）
watch(
  () => [props.variables, props.outputDefinitions],
  () => applyVariableDecorations(),
  { deep: true }
)

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose()
    editorInstance = null
  }
  decorations = null
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

<!-- Monaco 的动态 token 在组件作用域外，scoped 样式够不到，必须用非 scoped 样式 -->
<style>
.var-resolved {
  text-decoration: underline dotted #4ade80;
  text-underline-offset: 3px;
}
.var-pending {
  text-decoration: underline dashed #fbbf24;
  text-underline-offset: 3px;
}
.var-missing {
  text-decoration: underline wavy #f87171;
  text-underline-offset: 3px;
  background: rgba(248, 113, 113, 0.12);
}
</style>
