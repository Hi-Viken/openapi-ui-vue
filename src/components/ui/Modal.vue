<template>
  <dialog ref="dialogRef" class="modal" @cancel="$emit('close')" @click="onBackdropClick">
    <header class="section-heading">
      <h2>{{ title }}</h2>
      <IconButton :label="$t('ui.closeDialog')" @click="$emit('close')">
        <X :size="18" />
      </IconButton>
    </header>
    <slot />
  </dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import IconButton from './IconButton.vue'
import { X } from 'lucide-vue-next'

defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const dialogRef = ref<HTMLDialogElement>()

onMounted(() => dialogRef.value?.showModal())
onUnmounted(() => dialogRef.value?.close())

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialogRef.value) {
    emit('close')
  }
}
</script>
