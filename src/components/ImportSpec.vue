<template>
  <Modal :title="$t('import.title')" @close="$emit('close')">
    <div class="subtabs" role="tablist" :aria-label="$t('import.source')">
      <button
        v-for="item in importTabs"
        :key="item.key"
        role="tab"
        :aria-selected="tab === item.key"
        @click="tab = item.key; value = ''"
      >
        {{ item.label }}
      </button>
    </div>
    <div class="import-content">
      <label v-if="tab === 'URL'">
        {{ $t('import.specUrl') }}
        <input
          type="url"
          v-model="value"
          :placeholder="$t('import.urlPlaceholder')"
        />
      </label>
      <label v-else-if="tab === 'File'" class="file-import">
        <Upload :size="26" />
        <span>{{ $t('import.fileFormat') }}</span>
        <input
          :aria-label="$t('import.specFile')"
          type="file"
          accept=".json,.yaml,.yml"
          @change="onFileSelect"
        />
      </label>
      <CodeEditor
        v-else-if="tab === 'Paste'"
        :label="$t('import.specContent')"
        :value="value"
        @change="value = $event"
      />
      <div v-else-if="tab === 'Examples'" class="example-list">
        <button
          v-for="[url, name] in examples"
          :key="url"
          :disabled="busy"
          @click="importValue(url)"
        >
          <FileCode2 :size="20" />
          {{ name }}
        </button>
      </div>
      <button
        v-if="['URL', 'Paste'].includes(tab)"
        class="primary"
        :disabled="busy || !value.trim()"
        @click="importValue(tab === 'URL' ? value.trim() : 'pasted-spec', tab === 'Paste' ? value : undefined)"
      >
        <Upload :size="16" />
        {{ busy ? $t('import.importing') : $t('import.import') }}
      </button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Upload, FileCode2 } from 'lucide-vue-next'
import Modal from './ui/Modal.vue'
import CodeEditor from './ui/CodeEditor.vue'
import { parseSpec } from '@/lib/api'
import type { Notify, OpenApiDocument } from '@/types'

const { t } = useI18n()

const props = defineProps<{ notify: Notify }>()
const emit = defineEmits<{
  close: []
  import: [spec: OpenApiDocument, source: string, text: string]
}>()

const importTabs = computed(() => [
  { key: 'URL', label: t('import.url') },
  { key: 'File', label: t('import.file') },
  { key: 'Paste', label: t('import.paste') },
  { key: 'Examples', label: t('import.examples') },
])

const tab = ref('URL')
const value = ref('')
const busy = ref(false)

const examples = computed(() => [
  ['swagger.json', t('import.sampleApi')],
  ['sample-specs/interactive-api.json', t('import.interactiveApi')],
  ['sample-specs/test-security-swagger.json', t('import.authSchemes')],
])

async function importValue(source: string, text?: string) {
  busy.value = true
  try {
    let specText = text
    if (specText === undefined) {
      const url = new URL(source, location.href)
      if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Only HTTP and HTTPS specification URLs are supported.')
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      specText = await response.text()
      source = url.href
    }
    emit('import', parseSpec(specText), source, specText)
    emit('close')
  } catch (error) {
    props.notify(error instanceof Error ? error.message : String(error), true)
  } finally {
    busy.value = false
  }
}

async function onFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) await importValue(`file:${file.name}`, await file.text())
}
</script>
