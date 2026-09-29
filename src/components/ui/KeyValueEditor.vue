<template>
  <div class="key-values">
    <div class="kv-heading">
      <span>
        {{ nameLabel }}
        <InfoTip v-if="outputs" :label="$t('kvEditor.outputNameHelp')">
          {{ $t('kvEditor.outputNameDesc') }}
        </InfoTip>
      </span>
      <span>
        {{ valueLabel }}
        <InfoTip v-if="outputs" :label="$t('kvEditor.outputPathHelp')">
          {{ $t('kvEditor.outputPathDesc') }}
        </InfoTip>
      </span>
    </div>
    <div v-for="(row, index) in localRows" :key="index" class="kv-row">
      <input
        v-if="!outputs"
        type="checkbox"
        :aria-label="`${$t('kvEditor.enablePrefix')} ${row.name || index + 1}`"
        :checked="row.enabled !== false"
        :disabled="row.required"
        @change="update(index, { enabled: ($event.target as HTMLInputElement).checked })"
      />
      <div class="kv-name">
        <VariableInput
          :aria-label="`${nameLabel} ${index + 1}`"
          :variables="variables"
          :output-definitions="outputDefinitions"
          :model-value="row.name || ''"
          :readonly="row.required"
          @update:model-value="update(index, { name: $event })"
          :placeholder="nameLabel"
        />
        <span v-if="row.required" class="required">{{ $t('kvEditor.required') }}</span>
      </div>
      <select
        v-if="locations"
        :aria-label="`${$t('kvEditor.locationPrefix')} ${index + 1}`"
        :value="row.location || 'query'"
        @change="update(index, { location: ($event.target as HTMLSelectElement).value })"
      >
        <option value="query">{{ $t('kvEditor.query') }}</option>
        <option value="path">{{ $t('kvEditor.path') }}</option>
        <option value="header">{{ $t('kvEditor.header') }}</option>
        <option value="cookie">{{ $t('kvEditor.cookie') }}</option>
      </select>
      <input
        v-if="row.file"
        type="file"
        :aria-label="`${$t('kvEditor.filePrefix')} ${row.name}`"
        @change="onFile?.(row.name, ($event.target as HTMLInputElement).files?.[0])"
      />
      <VariableInput
        v-else
        :aria-label="`${valueLabel} ${row.name || index + 1}`"
        :variables="variables"
        :output-definitions="outputDefinitions"
        :model-value="(outputs ? row.path : row.value) ?? ''"
        @update:model-value="update(index, { [outputs ? 'path' : 'value']: $event })"
        :placeholder="outputs ? '$.data.id' : valueLabel"
      />
      <select
        v-if="files"
        :aria-label="`${$t('kvEditor.typePrefix')} ${row.name || index + 1}`"
        :value="row.file ? 'file' : 'text'"
        @change="update(index, { file: ($event.target as HTMLSelectElement).value === 'file' })"
      >
        <option value="text">{{ $t('kvEditor.text') }}</option>
        <option value="file">{{ $t('kvEditor.file') }}</option>
      </select>
      <IconButton
        :label="`${$t('kvEditor.removePrefix')} ${row.name || $t('kvEditor.rowPrefix') + ' ' + (index + 1)}`"
        :disabled="row.required"
        @click="removeRow(index)"
      >
        <Trash2 :size="15" />
      </IconButton>
    </div>
    <button class="text-button" @click="addRow">
      <Plus :size="15" />
      {{ addLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import IconButton from './IconButton.vue'
import VariableInput from './VariableInput.vue'
import InfoTip from './InfoTip.vue'
import { Trash2, Plus } from 'lucide-vue-next'
import type { KeyValueRow, Variables } from '@/types'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  rows?: KeyValueRow[]
  nameLabel?: string
  valueLabel?: string
  addLabel?: string
  locations?: boolean
  outputs?: boolean
  files?: boolean
  onFile?: (name: string, file?: File) => void
  variables?: Variables
  outputDefinitions?: KeyValueRow[]
}>(), {
  rows: () => [],
})

const nameLabel = props.nameLabel ?? t('kvEditor.name')
const valueLabel = props.valueLabel ?? t('kvEditor.value')
const addLabel = props.addLabel ?? t('kvEditor.addRow')

const emit = defineEmits<{ change: [rows: KeyValueRow[]] }>()

const localRows = ref<KeyValueRow[]>([...props.rows])

watch(() => props.rows, (newVal) => { localRows.value = [...newVal] }, { deep: true })

function update(index: number, patch: Partial<KeyValueRow>) {
  localRows.value = localRows.value.map((row, i) => i === index ? { ...row, ...patch } : row)
  emit('change', [...localRows.value])
}

function removeRow(index: number) {
  localRows.value = localRows.value.filter((_, i) => i !== index)
  emit('change', [...localRows.value])
}

function addRow() {
  localRows.value = [...localRows.value, {
    name: '',
    value: '',
    enabled: true,
    ...(props.locations ? { location: 'query' } : {}),
    ...(props.outputs ? { path: '' } : {}),
  }]
  emit('change', [...localRows.value])
}
</script>
