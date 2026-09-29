<template>
  <span :class="['method', `method-${method.toLowerCase()}`]">
    {{ method.toUpperCase() }}
  </span>
</template>

<script setup lang="ts">
defineProps<{ method: string }>()
</script>
