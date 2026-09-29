<template>
  <IconButton :label="$t('ui.copyToClipboard')" @click="copy">
    <Copy :size="16" />
  </IconButton>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IconButton from './IconButton.vue'
import { Copy } from 'lucide-vue-next'
import type { Notify } from '@/types'

const { t } = useI18n()

const props = defineProps<{ value: string; notify?: Notify }>()

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    props.notify?.(t('ui.copied'))
  } catch {
    props.notify?.(t('ui.clipboardError'), true)
  }
}
</script>
