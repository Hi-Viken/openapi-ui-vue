<template>
  <InfoTip
    :label="$t('ui.variableValuesFor', { field: ariaLabel || $t('ui.field') })"
    :active="references.length > 0"
  >
    <template #trigger>
      <input
        v-bind="$attrs"
        :class="[references.length ? `variable-field-${status}` : '', $attrs.class || '']"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </template>
    <div v-for="ref in references" :key="ref.start" class="variable-preview">
      {{ referenceDescription(ref) }}
    </div>
  </InfoTip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InfoTip from './InfoTip.vue'
import { variableReferences } from '@/lib/api'
import { referenceDescription as describeReference } from '@/lib/variableText'
import type { KeyValueRow, Variables } from '@/types'

defineOptions({ inheritAttrs: false })

const { t } = useI18n()

const props = withDefaults(defineProps<{
  modelValue?: string
  variables?: Variables
  outputDefinitions?: KeyValueRow[]
  ariaLabel?: string
}>(), { modelValue: '' })

defineEmits<{ 'update:modelValue': [value: string] }>()

const references = computed(() =>
  props.variables ? variableReferences(props.modelValue, props.variables, props.outputDefinitions) : []
)

const status = computed(() => {
  if (references.value.some((r) => r.status === 'missing')) return 'missing'
  if (references.value.some((r) => r.status === 'pending')) return 'pending'
  return 'resolved'
})

function referenceDescription(reference: any): string {
  return describeReference(reference, t)
}
</script>
