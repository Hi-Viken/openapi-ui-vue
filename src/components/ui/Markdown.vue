<template>
  <div class="markdown" v-html="renderedHtml"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{ children?: string }>()

const renderedHtml = computed(() => {
  const html = marked.parse(String(props.children || ''), { async: false }) as string
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['img', 'style', 'iframe'],
    FORBID_ATTR: ['style'],
  })
})
</script>
