<template>
  <button
    type="button"
    class="icon-button"
    :aria-label="label"
    :title="label"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
defineEmits<{ click: [event: MouseEvent] }>()
</script>
