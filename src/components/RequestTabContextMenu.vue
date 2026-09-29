<template>
  <div
    class="tab-context-menu"
    role="menu"
    :aria-label="$t('contextMenu.actions')"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
  >
    <button type="button" role="menuitem" @click="$emit('favorite')">
      <Star :size="14" :fill="isFavorite ? 'currentColor' : 'none'" />
      {{ isFavorite ? $t('contextMenu.removeFromFav') : $t('contextMenu.addToFav') }}
    </button>
    <button type="button" role="menuitem" @click="$emit('add-to-runner')">
      <PlayIcon :size="14" />
      {{ $t('contextMenu.addToRunner') }}
    </button>
    <button type="button" role="menuitem" @click="$emit('action', 'close', [tabId])">
      <X :size="14" />
      {{ $t('contextMenu.close') }}
    </button>
    <button type="button" role="menuitem" :disabled="otherIds.length === 0" @click="$emit('action', 'closeOthers', otherIds)">
      <PanelsTopLeft :size="14" />
      {{ $t('contextMenu.closeOthers') }}
    </button>
    <button type="button" role="menuitem" :disabled="rightIds.length === 0" @click="$emit('action', 'closeToRight', rightIds)">
      <ChevronsRight :size="14" />
      {{ $t('contextMenu.closeRight') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { ChevronsRight, PanelsTopLeft, Star, X } from 'lucide-vue-next'
import PlayIcon from './ui/PlayIcon.vue'

const props = defineProps<{
  tabs: { id: string }[]
  tabId: string
  x: number
  y: number
  isFavorite: boolean
}>()

const emit = defineEmits<{
  close: []
  favorite: []
  'add-to-runner': []
  action: [action: string, ids: string[]]
}>()

const index = computed(() => props.tabs.findIndex((tab) => tab.id === props.tabId))
const rightIds = computed(() => props.tabs.slice(index.value + 1).map((tab) => tab.id))
const otherIds = computed(() => props.tabs.filter((tab) => tab.id !== props.tabId).map((tab) => tab.id))

function dismiss() { emit('close') }
function dismissOnKey(event: KeyboardEvent) { if (event.key === 'Escape') dismiss() }

onMounted(() => {
  document.addEventListener('click', dismiss)
  window.addEventListener('keydown', dismissOnKey)
})

onUnmounted(() => {
  document.removeEventListener('click', dismiss)
  window.removeEventListener('keydown', dismissOnKey)
})
</script>
